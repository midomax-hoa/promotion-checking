'use client'

/**
 * The shared settings, one input per key.
 *
 * The Vietnamese wording and the default both come from
 * `app-settings-catalog.ts`, the same list the seed uses, so a value shown as
 * "default" here is the value `npm run db:seed:reset` would write.
 */

import { useActionState } from 'react'
import { saveAppSettingsAction } from '@/app/cau-hinh/actions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DEFAULT_APP_SETTINGS } from '@/lib/config/app-settings-catalog'
import { INITIAL_CONFIG_STATE, settingField } from '@/lib/config/config-form-state'
import { cn } from '@/lib/utils'

export function AppSettingForm({ values }: { values: Record<string, string> }) {
  const [state, formAction, pending] = useActionState(saveAppSettingsAction, INITIAL_CONFIG_STATE)
  const fieldErrors = state.fieldErrors ?? {}

  return (
    // noValidate: server side validation owns the wording, in Vietnamese.
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {state.status === 'idle' ? null : (
        <Alert variant={state.status === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div key={state.version} className="overflow-hidden rounded-lg border">
        {DEFAULT_APP_SETTINGS.map((setting) => {
          const name = settingField(setting.key)
          const stored = values[setting.key] ?? setting.value
          const value = state.values?.[name] ?? stored
          const isDefault = stored === setting.value
          const error = fieldErrors[name]

          return (
            <div
              key={setting.key}
              className={cn(
                'flex flex-col gap-1 border-b px-3 py-2.5 transition-colors last:border-b-0 hover:bg-muted/40',
                !isDefault && 'bg-primary/5 hover:bg-primary/10',
              )}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <label htmlFor={name} className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{setting.description}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {setting.key}
                  </span>
                </label>
                <Input
                  id={name}
                  name={name}
                  defaultValue={value}
                  aria-invalid={error != null}
                  className={cn('h-8 w-56 tabular-nums', !isDefault && 'border-primary')}
                />
                {isDefault ? null : (
                  <button
                    type="submit"
                    name="intent"
                    value={'reset:' + setting.key}
                    title="Khôi phục giá trị mặc định của thiết lập này"
                    className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }))}
                    disabled={pending}
                  >
                    Về mặc định
                  </button>
                )}
              </div>
              {isDefault ? null : (
                <p className="text-xs text-primary">Mặc định: {setting.value}</p>
              )}
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
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
          {pending ? 'Đang lưu...' : 'Lưu thiết lập chung'}
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
