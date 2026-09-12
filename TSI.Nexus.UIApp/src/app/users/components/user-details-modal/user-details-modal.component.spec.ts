import { MatDialogRef } from '@angular/material/dialog';
import { User } from '@nexus/core';
import { UserDetailsModalComponent } from './user-details-modal.component';

describe('UserDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: any = null): UserDetailsModalComponent {
    dialogRefMock = { close: vi.fn() };
    return new UserDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<UserDetailsModalComponent>,
      dialogData,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('defaults to add mode with no data when there is no dialog data', () => {
    const component = createComponent();

    expect(component.isEdit).toBe(false);
    expect(component.data).toBeNull();
    expect(component.id).toBeNull();
  });

  it('initializes from dialog data in edit mode', () => {
    const user = { id: 'u1' } as User;
    const component = createComponent({ isEdit: true, data: user, id: 'u1' });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(user);
    expect(component.id).toBe('u1');
  });

  it('falls back to defaults when dialog data omits fields', () => {
    const component = createComponent({});

    expect(component.isEdit).toBe(false);
    expect(component.data).toBeNull();
    expect(component.id).toBeNull();
  });

  describe('close', () => {
    it('closes the dialog with no result', () => {
      const component = createComponent();
      component.close();

      expect(dialogRefMock.close).toHaveBeenCalledWith(null);
    });
  });
});
