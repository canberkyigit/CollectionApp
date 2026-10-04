import { Fragment, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, ExternalLink, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { setIntegrationKey, useIntegrationKey, type IntegrationKey } from '@/lib/integrationKeys';
import { useT } from '@/i18n';

const INTEGRATIONS: { key: IntegrationKey; href: string }[] = [
  { key: 'anthropic', href: 'https://console.anthropic.com/settings/keys' },
  { key: 'discogs', href: 'https://www.discogs.com/settings/developers' },
  { key: 'numista', href: 'https://en.numista.com/api/' },
];

type TestState = 'idle' | 'testing' | 'ok' | 'invalid' | 'error';

/** Validates an Anthropic API key with a cheap list-models call. */
async function testAnthropicKey(apiKey: string): Promise<Exclude<TestState, 'idle' | 'testing'>> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0 });
  try {
    await client.models.list({ limit: 1 });
    return 'ok';
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return 'invalid';
    }
    return 'error';
  }
}

function IntegrationRow({ integration }: { integration: (typeof INTEGRATIONS)[number] }) {
  const t = useT();
  const stored = useIntegrationKey(integration.key);
  const [draft, setDraft] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [testState, setTestState] = useState<TestState>('idle');
  const value = draft ?? stored;
  const inputId = `integration-${integration.key}`;
  const descriptionId = `${inputId}-description`;
  const isDirty = draft !== null && draft.trim() !== stored;
  const name = t(`settings.integrations.${integration.key}.name`);

  const save = () => {
    setIntegrationKey(integration.key, value);
    setDraft(null);
    setTestState('idle');
    toast.success(value.trim()
      ? t('settings.integrations.saved', { name })
      : t('settings.integrations.removed', { name }));
  };

  const remove = () => {
    setIntegrationKey(integration.key, '');
    setDraft(null);
    setTestState('idle');
    toast.success(t('settings.integrations.removed', { name }));
  };

  const runTest = async () => {
    setTestState('testing');
    try {
      setTestState(await testAnthropicKey(value.trim()));
    } catch {
      setTestState('error');
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={inputId} className="text-base">{name}</Label>
          <Badge variant={stored ? 'success' : 'secondary'} className="h-5 rounded-full px-2 text-[10px]">
            {stored && <CheckCircle2 className="mr-1 size-3" aria-hidden="true" />}
            {stored ? t('settings.integrations.statusSet') : t('settings.integrations.statusEmpty')}
          </Badge>
        </div>
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {t(`settings.integrations.${integration.key}.description`)}{' '}
          <a
            href={integration.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('settings.integrations.getKey')}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            id={inputId}
            type={visible ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            className="h-10 pr-10 font-mono text-sm"
            value={value}
            placeholder={t('settings.integrations.placeholder')}
            aria-describedby={descriptionId}
            onChange={(event) => {
              setDraft(event.target.value);
              setTestState('idle');
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground"
            aria-label={visible ? t('settings.integrations.hide', { name }) : t('settings.integrations.show', { name })}
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" disabled={!isDirty} onClick={save}>
            {t('common.save')}
          </Button>
          {integration.key === 'anthropic' && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!value.trim() || testState === 'testing'}
              onClick={() => void runTest()}
            >
              {testState === 'testing' ? t('settings.integrations.testing') : t('settings.integrations.test')}
            </Button>
          )}
          {stored && (
            <Button type="button" size="sm" variant="ghost" onClick={remove}>
              {t('common.remove')}
            </Button>
          )}
        </div>
      </div>
      {testState !== 'idle' && testState !== 'testing' && (
        <p
          role="status"
          className={testState === 'ok'
            ? 'rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400'
            : 'rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive'}
        >
          {t(`settings.integrations.test.${testState}`)}
        </p>
      )}
    </div>
  );
}

export function IntegrationsSection() {
  const t = useT();
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
          {t('settings.integrations.cardTitle')}
        </CardTitle>
        <CardDescription>{t('settings.integrations.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-3 rounded-[1.25rem] border border-primary/15 bg-primary/5 px-4 py-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm leading-6 text-muted-foreground">{t('settings.integrations.privacy')}</p>
        </div>
        {INTEGRATIONS.map((integration, index) => (
          <Fragment key={integration.key}>
            {index > 0 && <Separator />}
            <IntegrationRow integration={integration} />
          </Fragment>
        ))}
      </CardContent>
    </Card>
  );
}
