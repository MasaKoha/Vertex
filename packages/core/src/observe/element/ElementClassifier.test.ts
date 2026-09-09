import { describe, expect, it } from 'vitest';
import { requireElement } from '../../testing/DomGeometry.test-support';
import { classifyElement } from './ElementClassifier';

describe('classifyElement', () => {
  it.each([
    ['<button></button>', 'Button'], ['<a href="/"></a>', 'Link'], ['<input>', 'Input'],
    ['<textarea></textarea>', 'Input'], ['<select></select>', 'Select'],
    ['<input type="checkbox">', 'Checkbox'], ['<input type="radio">', 'Radio'],
    ['<input type="submit">', 'Button'], ['<input type="reset">', 'Button'],
    ['<input type="button">', 'Button'], ['<input type="image">', 'Button'],
    ['<h1></h1>', 'Heading'], ['<h2></h2>', 'Heading'], ['<h3></h3>', 'Heading'],
    ['<h4></h4>', 'Heading'], ['<h5></h5>', 'Heading'], ['<h6></h6>', 'Heading'],
    ['<label></label>', 'Text'], ['<img alt="">', 'Image'], ['<p>本文</p>', 'Text'],
    ['<li>項目</li>', 'Text'], ['<div data-testid="custom"></div>', 'Text'],
    ['<div role="button"></div>', 'Button'], ['<div role="checkbox"></div>', 'Checkbox'],
    ['<div role="radio"></div>', 'Radio'], ['<div role="switch"></div>', 'Checkbox'],
    ['<div role="slider"></div>', 'Input'], ['<div role="tab"></div>', 'Button'],
    ['<div role="menuitem"></div>', 'Button'], ['<div role="option"></div>', 'Select'],
    ['<div role="alert"></div>', 'Alert'], ['<div role="status"></div>', 'Alert'],
    ['<div>文字</div>', null], ['<span>文字</span>', null], ['<a>リンクなし</a>', null],
    ['<p> </p>', null], ['<li></li>', null], ['<img>', null], ['<div role="toString"></div>', null],
  ])('%s を %s と判定する', (markup, expected) => {
    document.body.innerHTML = markup;
    expect(classifyElement(requireElement('body > *'))).toBe(expected);
  });
});
