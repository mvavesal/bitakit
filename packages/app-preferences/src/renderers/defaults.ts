import {
  CardsControl,
  MultiChoiceControl,
  MultiCardsControl,
  CheckboxControl,
  NumberControl,
  RadioControl,
  SelectControl,
  SwitchControl,
  TextControl,
  TextareaControl,
} from '../components/controls.js';
import { defineSettingsRenderers, typeRenderer } from './builders.js';

/** Built-in layer: a generic control per type plus the named variants fields may request. */
export const builtInRenderers = defineSettingsRenderers({
  types: [
    typeRenderer('boolean', CheckboxControl),
    typeRenderer('boolean', CheckboxControl, { variant: 'checkbox' }),
    typeRenderer('boolean', SwitchControl, { variant: 'switch' }),
    typeRenderer('choice', SelectControl),
    typeRenderer('choice', SelectControl, { variant: 'select' }),
    typeRenderer('choice', RadioControl, { variant: 'radio', group: true }),
    typeRenderer('choice', CardsControl, { variant: 'cards', group: true }),
    typeRenderer('multi-choice', MultiChoiceControl, { group: true }),
    typeRenderer('multi-choice', MultiChoiceControl, { variant: 'checkbox', group: true }),
    typeRenderer('multi-choice', MultiCardsControl, { variant: 'cards', group: true }),
    typeRenderer('text', TextControl),
    typeRenderer('text', TextControl, { variant: 'input' }),
    typeRenderer('text', TextareaControl, { variant: 'textarea' }),
    typeRenderer('number', NumberControl),
    typeRenderer('number', NumberControl, { variant: 'input' }),
  ],
});
