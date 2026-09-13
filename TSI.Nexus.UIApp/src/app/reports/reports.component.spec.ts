import {
  ApiService,
  ModalService,
  Payment,
  PaymentStatus,
  PaymentType,
  TranslationService,
} from '@nexus/core';
import { Subject, of } from 'rxjs';
import { ReportsComponent } from './reports.component';

describe('ReportsComponent', () => {
  let apiServiceMock: { get: ReturnType<typeof vi.fn> };
  let modalServiceMock: { showTemplateModal: ReturnType<typeof vi.fn>; showPdfProgress: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent(): ReportsComponent {
    apiServiceMock = { get: vi.fn().mockReturnValue(of({ data: [] })) };
    modalServiceMock = { showTemplateModal: vi.fn(), showPdfProgress: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    return new ReportsComponent(
      apiServiceMock as unknown as ApiService,
      modalServiceMock as unknown as ModalService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('fetches payments and applies filters', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(
        of({ data: [{ id: 'p1', type: 'Incoming', price: 10 } as unknown as Payment] }),
      );

      component.ngOnInit();

      expect(apiServiceMock.get).toHaveBeenCalledWith('payments/getAll');
      expect(component.filteredData).toEqual(component.data);
    });
  });

  describe('showPaymentDetails', () => {
    it('opens the payment details modal with the transaction as parent', () => {
      const component = createComponent();
      modalServiceMock.showTemplateModal.mockReturnValue({
        componentInstance: null,
        close: vi.fn(),
      });

      component.showPaymentDetails({ id: 'p1', transactionId: 't1' } as Payment);

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: 'p1', parentId: 't1' }),
      );
    });

    it('reloads the payments and closes the modal when the form emits saved', () => {
      const component = createComponent();
      const saved$ = new Subject<void>();
      const closeMock = vi.fn();
      modalServiceMock.showTemplateModal.mockReturnValue({
        componentInstance: { saved: saved$ },
        close: closeMock,
      });

      component.showPaymentDetails({ id: 'p1' } as Payment);
      saved$.next();

      expect(apiServiceMock.get).toHaveBeenCalledWith('payments/getAll');
      expect(closeMock).toHaveBeenCalled();
    });
  });

  describe('applyFilters / clearFilters', () => {
    it('filters by status, type, and date range', () => {
      const component = createComponent();
      component.data = [
        { id: 'p1', status: 'Approved', type: 'Incoming', date: '2024-01-01' } as unknown as Payment,
        { id: 'p2', status: 'Pending', type: 'Outgoing', date: '2024-02-01' } as unknown as Payment,
      ];
      component.filterStatus.Approved = true;

      component.applyFilters();

      expect(component.filteredData.map((p) => p.id)).toEqual(['p1']);
    });

    it('excludes items with no date when a date filter is active', () => {
      const component = createComponent();
      component.data = [
        { id: 'p1' } as unknown as Payment,
        { id: 'p2', date: '2024-01-01' } as unknown as Payment,
      ];
      component.filterStartDate = '2024-01-01';

      component.applyFilters();

      expect(component.filteredData.map((p) => p.id)).toEqual(['p2']);
    });

    it('filters by start date only', () => {
      const component = createComponent();
      component.data = [
        { id: 'p1', date: '2024-01-01' } as unknown as Payment,
        { id: 'p2', date: '2024-02-01' } as unknown as Payment,
      ];
      component.filterStartDate = '2024-01-15';

      component.applyFilters();

      expect(component.filteredData.map((p) => p.id)).toEqual(['p2']);
    });

    it('filters by end date only', () => {
      const component = createComponent();
      component.data = [
        { id: 'p1', date: '2024-01-01' } as unknown as Payment,
        { id: 'p2', date: '2024-02-01' } as unknown as Payment,
      ];
      component.filterEndDate = '2024-01-15';

      component.applyFilters();

      expect(component.filteredData.map((p) => p.id)).toEqual(['p1']);
    });

    it('treats a missing status as an empty string when filtering by status', () => {
      const component = createComponent();
      component.data = [{ id: 'p1' } as unknown as Payment];
      component.filterStatus.Approved = true;

      component.applyFilters();

      expect(component.filteredData).toEqual([]);
    });

    it('filters by type', () => {
      const component = createComponent();
      component.data = [
        { id: 'p1', type: 'Incoming' } as unknown as Payment,
        { id: 'p2', type: 'Outgoing' } as unknown as Payment,
      ];
      component.filterType.Incoming = true;

      component.applyFilters();

      expect(component.filteredData.map((p) => p.id)).toEqual(['p1']);
    });

    it('clearFilters resets state and shows all data', () => {
      const component = createComponent();
      component.data = [{ id: 'p1' } as Payment];
      component.filterStatus.Approved = true;
      component.filterType.Incoming = true;

      component.clearFilters();

      expect(component.filterStatus).toEqual({
        Approved: false,
        Pending: false,
        Delayed: false,
      });
      expect(component.filterType).toEqual({ Incoming: false, Outgoing: false });
      expect(component.filteredData).toEqual([{ id: 'p1' }]);
    });
  });

  describe('label/color helpers', () => {
    it('returns empty strings for undefined values', () => {
      const component = createComponent();
      expect(component.getTypeLabel(undefined)).toBe('');
      expect(component.getStatusLabel(undefined)).toBe('');
      expect(component.getStatusColor(undefined)).toBe('');
    });

    it('translates known type/status/color values', () => {
      const component = createComponent();
      expect(component.getTypeLabel(PaymentType.Incoming)).toBe('REPORTS.INCOMING');
      expect(component.getStatusLabel(PaymentStatus.Delayed)).toBe('REPORTS.STATUS_DELAYED');
      expect(component.getStatusColor(PaymentStatus.Delayed)).toBe('danger');
    });

    it('falls back to the raw type/status when not found in the translation map', () => {
      const component = createComponent();
      expect(component.getTypeLabel('SomethingElse' as PaymentType)).toBe('SomethingElse');
      expect(component.getStatusLabel('SomethingElse' as PaymentStatus)).toBe('SomethingElse');
    });

    it('falls back to the default color for an unknown status', () => {
      const component = createComponent();
      expect(component.getStatusColor('SomethingElse' as PaymentStatus)).toBe('secondary');
    });
  });

  describe('totals', () => {
    it('sums incoming, outgoing, and the net total', () => {
      const component = createComponent();
      component.filteredData = [
        { type: 'Incoming', price: 100 } as unknown as Payment,
        { type: 'Outgoing', price: 40 } as unknown as Payment,
      ];

      expect(component.getTotalIncoming()).toBe(100);
      expect(component.getTotalOutgoing()).toBe(40);
      expect(component.getTotal()).toBe(60);
    });

    it('excludes items with a null price', () => {
      const component = createComponent();
      component.filteredData = [
        { type: 'Incoming', price: null } as unknown as Payment,
        { type: 'Outgoing', price: null } as unknown as Payment,
      ];

      expect(component.getTotalIncoming()).toBe(0);
      expect(component.getTotalOutgoing()).toBe(0);
      expect(component.getTotal()).toBe(0);
    });

    it('treats a type that is neither Incoming nor Outgoing as zero in the net total', () => {
      const component = createComponent();
      component.filteredData = [{ type: 'Other', price: 50 } as unknown as Payment];

      expect(component.getTotal()).toBe(0);
    });
  });

  describe('printSection', () => {
    it('does nothing when the print section is missing', () => {
      const component = createComponent();
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

      component.printSection();

      expect(printSpy).not.toHaveBeenCalled();
      printSpy.mockRestore();
    });

    it('swaps in the print section content and restores it afterwards', () => {
      const component = createComponent();
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      const section = document.createElement('div');
      section.id = 'print-section';
      section.innerHTML = '<p>Report</p>';
      document.body.appendChild(section);
      const originalBody = document.body.innerHTML;

      component.printSection();

      expect(printSpy).toHaveBeenCalled();
      expect(document.body.innerHTML).toBe(originalBody);
      printSpy.mockRestore();
    });
  });

  describe('generatePDF', () => {
    it('does nothing while already generating a PDF', async () => {
      const component = createComponent();
      component.generatingPdf = true;

      await component.generatePDF();

      expect(modalServiceMock.showPdfProgress).not.toHaveBeenCalled();
    });

    it('does nothing when the report table is missing from the DOM', async () => {
      const component = createComponent();

      await component.generatePDF();

      expect(modalServiceMock.showPdfProgress).not.toHaveBeenCalled();
      expect(component.generatingPdf).toBe(false);
    });

    it('does nothing when the table has no thead', async () => {
      const component = createComponent();
      const section = document.createElement('div');
      section.id = 'print-section';
      const table = document.createElement('table');
      table.id = 'report-data-table';
      section.appendChild(table);
      document.body.appendChild(section);

      await component.generatePDF();

      expect(modalServiceMock.showPdfProgress).not.toHaveBeenCalled();
      section.remove();
    });

    // The rest of generatePDF() - from showPdfProgress() onward - builds the header/rows and then
    // calls the real downloadReportPdf() (report-pdf.ts) via dynamic import. Empirically, driving
    // it with a full valid DOM under jsdom does not throw and does not resolve either: html2canvas
    // hangs indefinitely (no real Canvas 2D context available, see report-pdf.spec.ts's own
    // documented rationale for why that function isn't unit-testable here), so a test that
    // triggers it would hang rather than fail cleanly. That leaves this success path as an
    // accepted, documented residual - the same class of gap as downloadReportPdf() itself.
  });
});
