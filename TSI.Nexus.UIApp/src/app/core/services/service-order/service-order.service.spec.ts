import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService } from '@nexus/core';
import { ServiceOrderService } from './service-order.service';

describe('ServiceOrderService', () => {
  let apiServiceMock: { get: ReturnType<typeof vi.fn> };

  function createService(): ServiceOrderService {
    apiServiceMock = { get: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(ServiceOrderService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getByDriver hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getByDriver('d1');

    expect(apiServiceMock.get).toHaveBeenCalledWith('serviceorders/getByDriver/d1');
  });
});
