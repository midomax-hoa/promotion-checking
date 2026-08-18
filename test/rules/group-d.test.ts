import { describe, expect, it } from 'vitest'
import { d1NameValueMismatch } from '@/lib/rules/group-d-program/d1-name-value-mismatch'
import { d2NameMonthMismatch } from '@/lib/rules/group-d-program/d2-name-month-mismatch'
import { d3InconsistentProgram } from '@/lib/rules/group-d-program/d3-inconsistent-program'
import { d4StartDatePassed } from '@/lib/rules/group-d-program/d4-start-date-passed'
import { d5EndDatePassed } from '@/lib/rules/group-d-program/d5-end-date-passed'
import { d6EndBeforeStart } from '@/lib/rules/group-d-program/d6-end-before-start'
import { d7UnusualDuration } from '@/lib/rules/group-d-program/d7-unusual-duration'
import { d8ProgramNameExists } from '@/lib/rules/group-d-program/d8-program-name-exists'
import { d9InvalidUsageLimit } from '@/lib/rules/group-d-program/d9-invalid-usage-limit'
import { d10InconsistentUsageLimit } from '@/lib/rules/group-d-program/d10-inconsistent-usage-limit'
import { makePromotion, makeRow, runRule } from './fixtures'

/** 18/08/2026 - the day the sample file was surveyed. */
const NOW = new Date(2026, 7, 18)

describe('D1 - program name disagrees with the discount', () => {
  it('reports a name promising a different amount', () => {
    const rows = [makeRow({ programName: '2608GST130K', discountAmount: 140_000 })]
    const findings = runRule(d1NameValueMismatch, { rows, enabled: true, now: NOW })

    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('tên ghi 130.000đ')
    expect(findings[0].message).toContain('140.000đ')
  })

  it('accepts a name that matches', () => {
    const rows = [makeRow({ programName: '2608GST130K', discountAmount: 130_000 })]
    expect(runRule(d1NameValueMismatch, { rows, enabled: true, now: NOW })).toHaveLength(0)
  })

  it('checks percentages too', () => {
    const rows = [
      makeRow({ programName: '2510GPT50%', discountPercent: 0.3, discountAmount: null, discountType: 'percentage' }),
    ]
    expect(runRule(d1NameValueMismatch, { rows, enabled: true, now: NOW })[0].message).toContain('tên ghi 50%')
  })

  it('ships disabled', () => {
    const rows = [makeRow({ programName: '2608GST130K', discountAmount: 140_000 })]
    expect(runRule(d1NameValueMismatch, { rows, now: NOW })).toHaveLength(0)
  })
})

describe('D2 - program name disagrees with the month', () => {
  it('reports a July start under an August name', () => {
    const rows = [makeRow({ programName: '2608GST10K', startAt: new Date(2026, 6, 1) })]
    const findings = runRule(d2NameMonthMismatch, { rows, enabled: true, now: NOW })

    expect(findings[0].message).toContain('tháng 8/2026')
    expect(findings[0].message).toContain('01/07/2026')
  })

  it('accepts a matching month', () => {
    const rows = [makeRow({ programName: '2608GST10K', startAt: new Date(2026, 7, 1) })]
    expect(runRule(d2NameMonthMismatch, { rows, enabled: true, now: NOW })).toHaveLength(0)
  })

  it('stays silent on a name outside the convention', () => {
    const rows = [makeRow({ programName: 'Khuyến mãi hè', startAt: new Date(2026, 6, 1) })]
    expect(runRule(d2NameMonthMismatch, { rows, enabled: true, now: NOW })).toHaveLength(0)
  })
})

describe('D3 - rows of one program disagree', () => {
  it('names every field in conflict', () => {
    const rows = [
      makeRow({ rowNumber: 2, programName: 'P', discountAmount: 10_000, endAt: new Date(2026, 7, 31) }),
      makeRow({ rowNumber: 3, programName: 'P', discountAmount: 20_000, endAt: new Date(2026, 8, 30) }),
    ]
    const findings = runRule(d3InconsistentProgram, { rows, now: NOW })

    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('2 ngày kết thúc khác nhau')
    expect(findings[0].message).toContain('2 mức giảm khác nhau')
  })

  it('shows a blank value as such', () => {
    const rows = [
      makeRow({ rowNumber: 2, programName: 'P', discountAmount: 0 }),
      makeRow({ rowNumber: 3, programName: 'P', discountAmount: null }),
    ]
    expect(runRule(d3InconsistentProgram, { rows, now: NOW })[0].message).toContain('(bỏ trống)')
  })

  it('accepts a consistent program', () => {
    const rows = [makeRow({ rowNumber: 2, programName: 'P' }), makeRow({ rowNumber: 3, programName: 'P' })]
    expect(runRule(d3InconsistentProgram, { rows, now: NOW })).toHaveLength(0)
  })
})

describe('D4 / D5 / D6 - the date window', () => {
  it('D4 counts how many days ago the program started', () => {
    const rows = [makeRow({ startAt: new Date(2026, 7, 1), endAt: new Date(2026, 7, 31) })]
    const findings = runRule(d4StartDatePassed, { rows, now: NOW })

    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('01/08/2026 đã trôi qua 17 ngày')
  })

  it('D4 stays quiet for a program starting today', () => {
    const rows = [makeRow({ startAt: NOW })]
    expect(runRule(d4StartDatePassed, { rows, now: NOW })).toHaveLength(0)
  })

  it('D5 says the promotion will never run', () => {
    const rows = [makeRow({ startAt: new Date(2025, 9, 24), endAt: new Date(2025, 11, 31) })]
    expect(runRule(d5EndDatePassed, { rows, now: NOW })[0].message).toContain('không bao giờ chạy')
  })

  it('D6 reports a backwards window as a 422', () => {
    const rows = [makeRow({ startAt: new Date(2026, 7, 31), endAt: new Date(2026, 7, 1) })]
    const findings = runRule(d6EndBeforeStart, { rows, now: NOW })

    expect(findings[0].message).toContain('sớm hơn 30 ngày')
    expect(findings[0].message).toContain('422')
  })

  it('reports once per program, not once per row', () => {
    const rows = [
      makeRow({ rowNumber: 2, programName: 'P', startAt: new Date(2026, 7, 1) }),
      makeRow({ rowNumber: 3, programName: 'P', startAt: new Date(2026, 7, 1) }),
      makeRow({ rowNumber: 4, programName: 'P', startAt: new Date(2026, 7, 1) }),
    ]
    expect(runRule(d4StartDatePassed, { rows, now: NOW })).toHaveLength(1)
  })
})

describe('D7 - unusual duration', () => {
  it('reports a run longer than the ceiling', () => {
    const rows = [makeRow({ startAt: new Date(2026, 0, 1), endAt: new Date(2026, 11, 31) })]
    const findings = runRule(d7UnusualDuration, { rows, now: NOW })

    expect(findings[0].message).toContain('kéo dài 364 ngày')
    expect(findings[0].message).toContain('vượt ngưỡng 90 ngày')
  })

  it('reports a same-day program', () => {
    const rows = [makeRow({ startAt: new Date(2026, 7, 1), endAt: new Date(2026, 7, 1) })]
    expect(runRule(d7UnusualDuration, { rows, now: NOW })[0].message).toContain('cùng ngày')
  })

  it('honours a raised ceiling', () => {
    const rows = [makeRow({ startAt: new Date(2026, 0, 1), endAt: new Date(2026, 11, 31) })]
    expect(runRule(d7UnusualDuration, { rows, now: NOW, params: { maxDurationDays: 400 } })).toHaveLength(0)
  })

  it('leaves a backwards window to D6', () => {
    const rows = [makeRow({ startAt: new Date(2026, 7, 31), endAt: new Date(2026, 7, 1) })]
    expect(runRule(d7UnusualDuration, { rows, now: NOW })).toHaveLength(0)
  })
})

describe('D8 - program name already on Haravan', () => {
  it('lists the existing program with its window', () => {
    const rows = [makeRow({ programName: '2608GST10K' })]
    const findings = runRule(d8ProgramNameExists, {
      rows,
      now: NOW,
      haravanPromotions: [makePromotion({ name: '2608gst10k' })],
    })

    expect(findings[0].message).toContain('đã có trên Haravan')
    expect(findings[0].message).toContain('01/08/2026 - 31/08/2026')
  })

  it('is skipped, not passed, when the promotion list was never fetched', () => {
    const rows = [makeRow({ programName: '2608GST10K' })]
    expect(runRule(d8ProgramNameExists, { rows, now: NOW, haravanPromotions: null })).toHaveLength(0)
  })
})

describe('D9 / D10 - usage limit', () => {
  it('D9 explains what a zero means', () => {
    const rows = [makeRow({ usageLimit: 0 })]
    expect(runRule(d9InvalidUsageLimit, { rows, now: NOW })[0].message).toContain('không được dùng lần nào')
  })

  it('D9 reports a negative limit', () => {
    expect(runRule(d9InvalidUsageLimit, { rows: [makeRow({ usageLimit: -3 })], now: NOW })[0].message).toContain('số âm')
  })

  it('D9 treats a blank cell as no limit', () => {
    expect(runRule(d9InvalidUsageLimit, { rows: [makeRow({ usageLimit: null })], now: NOW })).toHaveLength(0)
  })

  it('D10 lists the conflicting limits', () => {
    const rows = [
      makeRow({ rowNumber: 2, programName: 'P', usageLimit: 100 }),
      makeRow({ rowNumber: 3, programName: 'P', usageLimit: null }),
    ]
    expect(runRule(d10InconsistentUsageLimit, { rows, now: NOW })[0].message).toContain('100, (bỏ trống)')
  })
})
