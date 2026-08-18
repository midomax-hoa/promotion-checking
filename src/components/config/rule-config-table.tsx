'use client'

/**
 * The 37 rules, grouped A-F, in one form.
 *
 * One form rather than one per rule, so a whole-group switch or a reset carries
 * the pending edits with it instead of throwing them away. The defaults come
 * straight from `rule-catalog.ts`, which is also what a reset writes back - the
 * screen can therefore never disagree with the seed about what "default" means.
 */

import { useActionState } from 'react'
import { saveRuleConfigsAction } from '@/app/cau-hinh/actions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { SEVERITY_META, SEVERITY_ORDER } from '@/components/check/severity-badge'
import { INITIAL_CONFIG_STATE } from '@/lib/config/config-form-state'
import { ruleField, sameRuleConfig } from '@/lib/config/rule-config-form'
import { ruleGroupAnchor } from '@/lib/config/rule-group-anchor'
import {
  GROUP_CODES,
  GROUP_TITLES,
  RULE_CATALOG,
  type RuleDefinition,
} from '@/lib/rules/rule-catalog'
import type { RuleConfigInput } from '@/lib/rules/rule-config-store'
import { cn } from '@/lib/utils'
import { GroupToggle } from './group-toggle'
import { RuleParamEditor } from './rule-param-editor'

function toConfig(definition: RuleDefinition): RuleConfigInput {
  return {
    code: definition.code,
    enabled: definition.defaultEnabled,
    severity: definition.defaultSeverity,
    params: { ...definition.defaultParams },
  }
}

export function RuleConfigTable({ configs }: { configs: readonly RuleConfigInput[] }) {
  const [state, formAction, pending] = useActionState(saveRuleConfigsAction, INITIAL_CONFIG_STATE)
  const byCode = new Map(configs.map((config) => [config.code, config]))
  const fieldErrors = state.fieldErrors ?? {}

  return (
    // noValidate: the browser would block the submit with an English bubble, and
    // the screen has a Vietnamese message for every bound it enforces.
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {state.status === 'idle' ? null : (
        <Alert variant={state.status === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div key={state.version} className="flex flex-col gap-4">
        {GROUP_CODES.map((groupCode) => {
          const definitions = RULE_CATALOG.filter((rule) => rule.groupCode === groupCode)
          const enabledCount = definitions.filter(
            (definition) => (byCode.get(definition.code) ?? toConfig(definition)).enabled,
          ).length

          return (
            <section
              key={groupCode}
              id={ruleGroupAnchor(groupCode)}
              // Offset so a jump does not land the heading underneath the
              // sticky group list that sent the user here.
              className="scroll-mt-20 overflow-hidden rounded-lg border"
            >
              <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                <h3 className="text-sm font-semibold">{GROUP_TITLES[groupCode]}</h3>
                <GroupToggle
                  groupCode={groupCode}
                  enabledCount={enabledCount}
                  total={definitions.length}
                  pending={pending}
                />
              </header>
              {definitions.map((definition) => (
                <RuleRow
                  key={definition.code}
                  definition={definition}
                  config={byCode.get(definition.code) ?? toConfig(definition)}
                  fieldErrors={fieldErrors}
                  submitted={state.values}
                  pending={pending}
                />
              ))}
            </section>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          name="intent"
          value="save"
          className={cn(buttonVariants({ size: 'lg' }))}
          disabled={pending}
        >
          {pending ? 'Đang lưu...' : 'Lưu cấu hình luật'}
        </button>
        <button
          type="submit"
          name="intent"
          value="reset-all"
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
          disabled={pending}
        >
          Khôi phục mặc định toàn bộ
        </button>
      </div>
    </form>
  )
}

function RuleRow({
  definition,
  config,
  fieldErrors,
  submitted,
  pending,
}: {
  definition: RuleDefinition
  config: RuleConfigInput
  fieldErrors: Record<string, string>
  submitted?: Record<string, string>
  pending: boolean
}) {
  const isDefault = sameRuleConfig(config, toConfig(definition))
  const enabledName = ruleField.enabled(definition.code)
  const severityName = ruleField.severity(definition.code)
  // An unchecked box submits nothing, so on a rejected submit "absent" means off.
  const checked = submitted ? submitted[enabledName] != null : config.enabled

  return (
    <div className={cn('border-b px-3 py-2 last:border-b-0', !isDefault && 'bg-primary/5')}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          id={enabledName}
          name={enabledName}
          defaultChecked={checked}
          className="size-4 accent-primary"
        />
        <label htmlFor={enabledName} className="flex flex-1 flex-wrap items-baseline gap-2 text-sm">
          <span className="font-mono text-xs text-muted-foreground">{definition.code}</span>
          <span className="flex-1">{definition.title}</span>
          {definition.defaultEnabled ? null : (
            <span className="text-xs text-muted-foreground">mặc định tắt</span>
          )}
        </label>
        <select
          name={severityName}
          defaultValue={submitted?.[severityName] ?? config.severity}
          className="h-7 rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          {SEVERITY_ORDER.map((severity) => (
            <option key={severity} value={severity}>
              {SEVERITY_META[severity].dot} {SEVERITY_META[severity].label}
            </option>
          ))}
        </select>
        {isDefault ? null : (
          <button
            type="submit"
            name="intent"
            value={'reset:' + definition.code}
            title="Khôi phục giá trị mặc định của luật này"
            className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }))}
            disabled={pending}
          >
            Về mặc định
          </button>
        )}
      </div>
      <RuleParamEditor
        code={definition.code}
        params={config.params}
        defaultParams={{ ...definition.defaultParams }}
        fieldErrors={fieldErrors}
        submitted={submitted}
      />
    </div>
  )
}
