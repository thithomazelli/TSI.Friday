import { FormControl, FormGroup, Validators } from '@angular/forms';
import { FormBaseComponent } from './form-base.model';

describe('FormBaseComponent', () => {
  function createComponent(): FormBaseComponent {
    const component = new FormBaseComponent();
    component.form = new FormGroup({
      name: new FormControl('', [Validators.required]),
    });
    return component;
  }

  describe('isInvalid', () => {
    it('returns false when the field does not exist', () => {
      const component = createComponent();
      expect(component.isInvalid('missing')).toBe(false);
    });

    it('returns false for an invalid field that has not been touched or submitted', () => {
      const component = createComponent();
      expect(component.isInvalid('name')).toBe(false);
    });

    it('returns true for an invalid field once it has been touched', () => {
      const component = createComponent();
      component.form.get('name')?.markAsTouched();

      expect(component.isInvalid('name')).toBe(true);
    });

    it('returns true for an invalid field once the form has been submitted', () => {
      const component = createComponent();
      component.submitted = true;

      expect(component.isInvalid('name')).toBe(true);
    });

    it('returns false for a valid, touched field', () => {
      const component = createComponent();
      component.form.get('name')?.setValue('Ana');
      component.form.get('name')?.markAsTouched();

      expect(component.isInvalid('name')).toBe(false);
    });
  });

  describe('isValid', () => {
    it('returns false when the field does not exist', () => {
      const component = createComponent();
      expect(component.isValid('missing')).toBe(false);
    });

    it('returns false for an invalid field', () => {
      const component = createComponent();
      component.form.get('name')?.markAsTouched();

      expect(component.isValid('name')).toBe(false);
    });

    it('returns false for a valid field that has not been touched or submitted', () => {
      const component = createComponent();
      component.form.get('name')?.setValue('Ana');

      expect(component.isValid('name')).toBe(false);
    });

    it('returns false for a valid, touched field whose value is only whitespace', () => {
      const component = createComponent();
      component.form.get('name')?.setValue('   ');
      component.form.get('name')?.markAsTouched();

      expect(component.isValid('name')).toBe(false);
    });

    it('returns true for a valid, touched field with a real value', () => {
      const component = createComponent();
      component.form.get('name')?.setValue('Ana');
      component.form.get('name')?.markAsTouched();

      expect(component.isValid('name')).toBe(true);
    });

    it('returns true for a valid field once the form has been submitted', () => {
      const component = createComponent();
      component.form.get('name')?.setValue('Ana');
      component.submitted = true;

      expect(component.isValid('name')).toBe(true);
    });
  });

  describe('inputHasError', () => {
    it('returns false before the form has been submitted, even with a matching error', () => {
      const component = createComponent();
      expect(component.inputHasError('name', 'required')).toBe(false);
    });

    it('returns true once submitted when the field has the given error', () => {
      const component = createComponent();
      component.submitted = true;

      expect(component.inputHasError('name', 'required')).toBe(true);
    });

    it('returns false once submitted when the field does not have the given error', () => {
      const component = createComponent();
      component.form.get('name')?.setValue('Ana');
      component.submitted = true;

      expect(component.inputHasError('name', 'required')).toBe(false);
    });

    it('returns false for a field that does not exist', () => {
      const component = createComponent();
      component.submitted = true;

      expect(component.inputHasError('missing', 'required')).toBe(false);
    });
  });

  describe('markAsTouched', () => {
    it('marks the given field as touched', () => {
      const component = createComponent();
      expect(component.form.get('name')?.touched).toBe(false);

      component.markAsTouched('name');

      expect(component.form.get('name')?.touched).toBe(true);
    });

    it('does nothing when the field does not exist', () => {
      const component = createComponent();
      expect(() => component.markAsTouched('missing')).not.toThrow();
    });
  });
});
