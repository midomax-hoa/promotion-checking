'use client'

/**
 * Threshold inputs for one rule, built from the field descriptors rather than
 * hand written per rule - so adding a threshold to `rule-config-schema.ts` is
 * enough to make it editable here.
 */

import { Input } from '@/components/ui/input'
import { ruleField } from '@/lib/config/rule-config-form'
import { ruleParamFields } from '@/lib/config/rule-config-schema'
import type { RuleParams } from '@/lib/rules/rule-catalog'
import { cn } from '@/lib/utils'

const NUMBER = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 6 })

function format(value: number | string | boolean | undefined): string {
  return typeof value === 'number' ? NUMBER.format(value) : String(value ?? '')
}

export function RuleParamEditor({
  code,
  params,
  defaultParams,
  fieldErrors,
  submitted,
}: {
  code: string
  params: RuleParams
  defaultParams: RuleParams
  fieldErrors: Record<string, string>
  /** Raw strings from a rejected submit; shown instead of the stored value. */
  submitted?: Record<string, string>
}) {
  const fields = ruleParamFields(code)
  if (fields.length === 0) return null

  return (
    <div className="flex flex-col gap-2 pt-1">
      {fields.map((field) => {
        const name = ruleField.param(code, field.key)
        const stored = params[field.key] ?? defaultParams[field.key] ?? ''
        const value = submitted?.[name] ?? String(stored)
        const isDefault = params[field.key] === defaultParams[field.key]
        const error = fieldErrors[name]

        return (
          <div key={field.key} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor={name} className="text-muted-foreground">
                {field.label}
              </label>
              <Input
                id={name}
                name={name}
                type="number"
                inputMode="decimal"
                step={field.integer ? 1 : 'any'}
                min={field.min}
                max={field.max}
                defaultValue={value}
                aria-invalid={error != null}
                className={cn('h-7 w-32 tabular-nums', !isDefault && 'border-primary')}
              />
              {field.unit ? (
                <span className="text-xs text-muted-foreground">{field.unit}</span>
              ) : null}
              {isDefault ? null : (
                <span className="text-xs text-primary">
                  mặc định {format(defaultParams[field.key])}
                </span>
              )}
            </div>
            {field.hint ? (
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            ) : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        )
      })}
    </div>
  )
}
