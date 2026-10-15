import { NextResponse } from 'next/server'
import { DEFAULT_STORE, readStore, writeStore } from '@/lib/store'

export async function POST() {
  // Back to a fresh account: keep the team, budget and allergies; subscriptions start again from onboarding.
  const keepProfile = { ...(await readStore()).profile, confirmed: false }
  await writeStore({ ...structuredClone(DEFAULT_STORE), profile: keepProfile, subscriptions: [] })
  return NextResponse.json({ ok: true })
}
