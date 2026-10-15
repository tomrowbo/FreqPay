import { NextResponse, type NextRequest } from 'next/server'
import { draftProfile, fitToBudget, previewPlan } from '@/lib/onboard'
import { readStore } from '@/lib/store'
import type { Profile } from '@/lib/rules'

// POST {prompt} -> Claude drafts a restock list -> priced preview. POST {profile} -> re-price an
// edited draft (no model call). Nothing is saved until the owner confirms via /api/profile.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const week = readStore().weekIndex + 1
  try {
    if (body.profile) {
      const profile = body.profile as Profile
      return NextResponse.json({ profile, preview: previewPlan(profile, week), notCovered: body.notCovered ?? [], assumptions: body.assumptions ?? [] })
    }
    const d = await draftProfile(String(body.prompt ?? ''))
    const fit = fitToBudget(d.profile, week)
    const assumptions = fit.scaledBy ? [...d.assumptions, `Scaled every quantity to ${Math.round(fit.scaledBy * 100)}% to fit the ${'£' + (d.profile.budgetPence / 100).toFixed(0)} budget`] : d.assumptions
    return NextResponse.json({ ...d, profile: fit.profile, preview: fit.preview, assumptions })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
