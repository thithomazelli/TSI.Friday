import { Router } from '@angular/router';
import { ModalService } from '@nexus/core';
import { LinkFieldComponent } from './link-field.component';

describe('LinkFieldComponent', () => {
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  let modalServiceMock: { hideModal: ReturnType<typeof vi.fn> };

  function createComponent(): LinkFieldComponent {
    routerMock = { navigate: vi.fn() };
    modalServiceMock = { hideModal: vi.fn() };

    return new LinkFieldComponent(
      routerMock as unknown as Router,
      modalServiceMock as unknown as ModalService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('onClick', () => {
    it('navigates and hides the modal when linkUrl has segments', () => {
      const component = createComponent();
      component.linkUrl = ['/orders', 'o1'];

      component.onClick();

      expect(routerMock.navigate).toHaveBeenCalledWith(['/orders', 'o1']);
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
    });

    it('does nothing when linkUrl is empty', () => {
      const component = createComponent();
      component.linkUrl = [];

      component.onClick();

      expect(routerMock.navigate).not.toHaveBeenCalled();
      expect(modalServiceMock.hideModal).not.toHaveBeenCalled();
    });

    it('does nothing when linkUrl is not set', () => {
      const component = createComponent();
      component.linkUrl = undefined as unknown as string[];

      expect(() => component.onClick()).not.toThrow();
      expect(routerMock.navigate).not.toHaveBeenCalled();
    });
  });
});
