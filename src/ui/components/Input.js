/**
 * Input — Styled text input with wrapper.
 */
export function createInput({ placeholder, value = '', maxLength = 30, type = 'text', onInput }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'input-wrapper';
  const input = document.createElement('input');
  input.type = type;
  input.className = 'input-field';
  input.placeholder = placeholder || '';
  input.value = value;
  input.maxLength = maxLength;
  input.autocomplete = 'off';
  input.spellcheck = false;
  wrapper.appendChild(input);
  if (onInput) input.addEventListener('input', (e) => onInput(e.target.value));
  return { el: wrapper, input };
}
