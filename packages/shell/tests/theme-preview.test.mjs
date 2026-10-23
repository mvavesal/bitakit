import test from 'node:test';
import assert from 'node:assert/strict';
import { themePreviewStyle } from '../dist/ui/settings/theme-preview.js';
import { defaultTheme } from '../dist/themes.js';

test('preview resets inherited flat effects even when central CSS var references span lines', () => {
  for (const mode of ['light', 'dark']) {
    const style = themePreviewStyle(defaultTheme, mode);
    for (const name of [
      'theme-control-gradient',
      'theme-shadow-control',
      'theme-control-hover-shadow',
      'theme-control-pressed-shadow',
      'theme-shadow-surface',
    ]) {
      assert.equal(style[`--${name}`], 'initial', `${mode} ${name} uses the central fallback`);
    }
  }
});

test('a preview keeps explicit flat effects and resets them when removed from the draft', () => {
  const draft = {
    ...defaultTheme,
    shared: { 'theme-control-gradient': 'none', 'theme-shadow-control': 'none' },
    light: { primary: '#223388' },
  };
  const flat = themePreviewStyle(draft, 'light');
  assert.equal(flat['--theme-control-gradient'], 'none');
  assert.equal(flat['--theme-shadow-control'], '0 0 #0000');
  const raised = themePreviewStyle({ ...draft, shared: {} }, 'light');
  assert.equal(raised['--theme-control-gradient'], 'initial');
  assert.equal(raised['--theme-shadow-control'], 'initial');
  assert.equal(raised['--primary'], flat['--primary']);
});
