#!/usr/bin/env python3
"""
import_toast_loyalty.py
=======================
Imports a Toast RewardsCards CSV export into the Sturgeon Spirits app.

What it does
------------
1. Reads every row from the CSV into toast_loyalty_accounts (upsert by toast_card_id).
2. Matches Toast accounts → app profiles by email (exact, case-insensitive),
   then by phone number (normalized to 10 digits).
3. For every newly-matched profile that hasn't had points imported yet:
   - Creates a `purchase_recorded` earn_event converting Toast points → app points
     at 10:1  (1 Toast pt = $1 spend = 10 app pts).
   - Updates profile.pos_customer_id  with the Toast account ID.
   - Backfills profile birthday if the profile doesn't already have one.
4. Prints a final summary.

Usage
-----
  pip install requests python-dotenv
  python3 scripts/import_toast_loyalty.py path/to/RewardsCards.csv

The script reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
.env.local (or environment variables). Edit the PRODUCTION section below to
point at your live Supabase instance before running.
"""

import csv
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests

# ── Configuration ─────────────────────────────────────────────────────────────

# Load from .env.local if present
env_path = Path(__file__).parent.parent / '.env.local'
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip())

SUPABASE_URL      = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/')
SERVICE_ROLE_KEY  = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

# Toast pts → app pts multiplier  (1 Toast pt = $1 spend = 10 app pts)
POINTS_MULTIPLIER = 10

# Minimum Toast points worth importing (skip zero-balance inactive accounts)
MIN_POINTS = 1

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    sys.exit('ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')

HEADERS = {
    'apikey':        SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def normalize_phone(raw: str) -> Optional[str]:
    """Strip to 10 digits (US). Returns None if result isn't exactly 10 digits."""
    digits = re.sub(r'\D', '', raw or '')
    if len(digits) == 11 and digits.startswith('1'):
        digits = digits[1:]
    return digits if len(digits) == 10 else None

def parse_toast_date(s: str) -> Optional[str]:
    """Parse Toast date strings like '7/30/2025 8:02 PM' → ISO 8601."""
    if not s:
        return None
    try:
        dt = datetime.strptime(s.strip(), '%m/%d/%Y %I:%M %p')
        return dt.replace(tzinfo=timezone.utc).isoformat()
    except ValueError:
        return None

def supabase(method: str, path: str, **kwargs):
    """Thin wrapper around requests for Supabase REST calls."""
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    # Merge any caller-supplied headers on top of the defaults
    extra_headers = kwargs.pop('headers', {})
    merged_headers = {**HEADERS, **extra_headers}
    resp = getattr(requests, method)(url, headers=merged_headers, **kwargs)
    if resp.status_code >= 400:
        raise RuntimeError(f'{method.upper()} {path} → {resp.status_code}: {resp.text[:300]}')
    return resp.json() if resp.text else []

# ── Main ──────────────────────────────────────────────────────────────────────

def main(csv_path: str):
    print(f'\n🥃  Sturgeon Spirits — Toast Loyalty Import')
    print(f'    CSV: {csv_path}')
    print(f'    DB:  {SUPABASE_URL}\n')

    # ── Step 1: Load CSV ──────────────────────────────────────────────────────
    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f))

    active = [r for r in rows if r.get('De-activated?', '').lower() != 'true']
    print(f'  Rows in CSV:     {len(rows):,}')
    print(f'  Active cards:    {len(active):,}')

    # ── Step 2: Fetch existing profiles (email + phone + id + pos_customer_id) ─
    print('\n  Fetching app profiles…')
    profiles_raw = supabase('get', 'profiles',
        params={'select': 'id,email,phone,pos_customer_id,display_name',
                'limit': '10000'})

    # Build lookup maps (normalised)
    email_to_profile  = {}
    phone_to_profile  = {}
    for p in profiles_raw:
        if p.get('email'):
            email_to_profile[p['email'].lower().strip()] = p
        if p.get('phone'):
            norm = normalize_phone(p['phone'])
            if norm:
                phone_to_profile[norm] = p

    print(f'  App profiles:    {len(profiles_raw):,}')

    # ── Step 3: Upsert all active cards into toast_loyalty_accounts ───────────
    print('\n  Upserting Toast accounts…')

    counters = dict(upserted=0, matched_email=0, matched_phone=0,
                    unmatched=0, points_imported=0, birthdays_saved=0,
                    skipped_deactivated=len(rows) - len(active))

    BATCH = 200
    records_to_upsert = []

    for r in active:
        toast_pts = int(r.get('Total Points', '0') or '0')
        email     = r.get('Email', '').strip().lower() or None
        phone_raw = r.get('Phone number', '').strip()
        phone     = normalize_phone(phone_raw)
        birthday  = r.get('Birthday (MM/DD)', '').strip() or None

        # Try to match a profile
        profile = None
        match_method = None
        if email:
            profile = email_to_profile.get(email)
            if profile:
                match_method = 'email'
        if not profile and phone:
            profile = phone_to_profile.get(phone)
            if profile:
                match_method = 'phone'

        records_to_upsert.append({
            'toast_card_id':    r['Card ID'],
            'toast_account_id': r['Account ID'],
            'card_number':      r.get('Card Number', '').strip() or None,
            'is_classic_card':  r.get('Classic Card?', '').lower() == 'true',
            'is_deactivated':   False,
            'email':            email,
            'phone':            phone,
            'toast_points':     toast_pts,
            'accrue_count':     int(r.get('# Accrue Trans.', '0') or '0'),
            'redeem_count':     int(r.get('# Redeem Trans.', '0') or '0'),
            'first_trans_at':   parse_toast_date(r.get('First Trans. Date', '')),
            'last_trans_at':    parse_toast_date(r.get('Last Trans. Date', '')),
            'birthday':         birthday,
            'profile_id':       profile['id'] if profile else None,
            'points_imported':  False,  # will set True after earn_event
        })

        if profile:
            if match_method == 'email':
                counters['matched_email'] += 1
            else:
                counters['matched_phone'] += 1
        else:
            counters['unmatched'] += 1

    # Batch upsert into toast_loyalty_accounts
    for i in range(0, len(records_to_upsert), BATCH):
        batch = records_to_upsert[i:i + BATCH]
        supabase('post', 'toast_loyalty_accounts',
            params={'on_conflict': 'toast_card_id'},
            headers={**HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal'},
            json=batch)
        counters['upserted'] += len(batch)
        print(f'    Upserted {min(i + BATCH, len(records_to_upsert)):,}/{len(records_to_upsert):,}', end='\r')

    print(f'\n  ✓ {counters["upserted"]:,} accounts upserted')
    print(f'    Matched by email:  {counters["matched_email"]:,}')
    print(f'    Matched by phone:  {counters["matched_phone"]:,}')
    print(f'    Unmatched:         {counters["unmatched"]:,}')

    # ── Step 4: Fetch the just-upserted accounts that have a profile match ─────
    print('\n  Importing points for matched accounts…')

    matched_accounts = supabase('get', 'toast_loyalty_accounts',
        params={'select': 'id,toast_account_id,profile_id,toast_points,birthday,points_imported',
                'profile_id': 'not.is.null',
                'points_imported': 'eq.false',
                'limit': '10000'})

    print(f'  Matched + pending import: {len(matched_accounts):,}')

    for acct in matched_accounts:
        profile_id  = acct['profile_id']
        toast_pts   = acct['toast_points'] or 0
        app_pts     = toast_pts * POINTS_MULTIPLIER
        birthday    = acct.get('birthday')

        # 4a. Create earn_event for point conversion (skip if zero points)
        if app_pts > 0:
            try:
                supabase('post', 'earn_events',
                    params={},
                    headers={**HEADERS, 'Prefer': 'return=minimal'},
                    json={
                        'user_id':      profile_id,
                        'event_type':   'purchase_recorded',
                        'points_delta': app_pts,
                        'context_type': 'toast_import',
                        'context_id':   acct['id'],
                        'notes':        f'Toast loyalty import: {toast_pts} Toast pts → {app_pts} app pts',
                    })
                counters['points_imported'] += 1
            except RuntimeError as e:
                print(f'\n    ⚠ earn_event failed for profile {profile_id}: {e}')

        # 4b. Update pos_customer_id on profile
        try:
            supabase('patch', f'profiles',
                params={'id': f'eq.{profile_id}'},
                headers={**HEADERS, 'Prefer': 'return=minimal'},
                json={'pos_customer_id': acct['toast_account_id']})
        except RuntimeError as e:
            print(f'\n    ⚠ pos_customer_id update failed: {e}')

        # 4c. Backfill birthday if profile doesn't have one (Toast stores MM/DD)
        if birthday:
            try:
                # Only update if profile birthday is missing
                supabase('patch', 'profiles',
                    params={'id': f'eq.{profile_id}', 'birthday': 'is.null'},
                    headers={**HEADERS, 'Prefer': 'return=minimal'},
                    json={'birthday': birthday})
                counters['birthdays_saved'] += 1
            except RuntimeError:
                pass

        # 4d. Mark as imported
        supabase('patch', 'toast_loyalty_accounts',
            params={'id': f'eq.{acct["id"]}'},
            headers={**HEADERS, 'Prefer': 'return=minimal'},
            json={'points_imported': True})

    # ── Step 5: Summary ───────────────────────────────────────────────────────
    total_app_pts = sum(
        (r['toast_points'] or 0) * POINTS_MULTIPLIER
        for r in records_to_upsert
        if r['profile_id']
    )

    print(f'\n  ✓ Points imported:    {counters["points_imported"]:,} accounts')
    print(f'  ✓ App points seeded:  {total_app_pts:,}')
    print(f'  ✓ Birthdays saved:    {counters["birthdays_saved"]:,}')
    print(f'  ✗ Unmatched (no app account yet): {counters["unmatched"]:,}')
    print(f'\n  Unmatched accounts will be auto-linked next time a customer')
    print(f'  signs up for the app using the same email or phone number.\n')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit('Usage: python3 import_toast_loyalty.py <path/to/RewardsCards.csv>')
    main(sys.argv[1])
