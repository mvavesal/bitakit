import test from 'node:test';
import assert from 'node:assert/strict';
import { mount, click, settle } from './support.mjs';
import { createElement as h, useState, act } from 'react';
import { BitaKitRuntimeProvider } from '@bitakit/ui';
import { ThemeColorField } from '../dist/ui/settings/color-field.js';

test('portaled color picker stays open while changing color instead of focusing the text input', async () => {
  let value;
  function Editor() {
    const [color, setColor] = useState('#804060');
    value = color;
    return h(ThemeColorField, {
      id: 'primary-color',
      label: 'Primary',
      value: color,
      inherited: '#000000',
      onChange: setColor,
    });
  }
  const view = await mount(h(BitaKitRuntimeProvider, { config: { plugins: [] } }, h(Editor)));
  try {
    await settle();
    await click(view.container.querySelector('[aria-label="Primary color picker"]'));
    const picker = () => document.querySelector('[data-slot="popover-content"]');
    assert.ok(picker(), 'the picker opens');
    const hue = picker().querySelector('[aria-label="Hue"]');
    await click(hue);
    assert.ok(picker(), 'clicking the portaled slider does not close the picker');
    assert.notEqual(
      document.activeElement?.id,
      'primary-color',
      'the text field does not steal focus',
    );
    await act(async () => {
      hue.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }),
      );
    });
    assert.notEqual(value, '#804060', 'keyboard color changes reach the draft');
    assert.ok(picker(), 'changing the color keeps the picker open');
  } finally {
    await view.unmount();
  }
});
