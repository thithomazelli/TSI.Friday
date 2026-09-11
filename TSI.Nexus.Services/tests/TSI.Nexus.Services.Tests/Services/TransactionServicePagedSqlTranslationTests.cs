using AutoMapper;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Data;
using TSI.Nexus.IoC;

namespace TSI.Nexus.Services.Tests.Services
{
    // TransactionService.FindAllPaged's status filter is expressed as Any()/All() over the
    // Payments navigation (Transaction.Status has no column of its own - see BuildFilter's
    // comment) - a class of LINQ expression the InMemory provider used by every other test in
    // this project does NOT validate for real SQL translatability, since it never actually
    // generates SQL. SQLite (a real relational provider, same as the OverdueRepositoryTests
    // pattern) is used here specifically to prove EF Core turns those Any()/All() calls into
    // valid, correct SQL instead of throwing at query time or silently mismatching
    // ComputeStatusFromPayments' in-memory semantics.
    public class TransactionServicePagedSqlTranslationTests : IDisposable
    {
        private readonly SqliteConnection _connection;
        private readonly MyDBContextEF _context;
        private readonly TransactionService _transactionService;

        public TransactionServicePagedSqlTranslationTests()
        {
            _connection = new SqliteConnection("Filename=:memory:");
            _connection.Open();

            var options = new DbContextOptionsBuilder<MyDBContextEF>().UseSqlite(_connection).Options;
            _context = new MyDBContextEF(options);
            _context.Database.EnsureCreated();

            var repository = new Repository.Repository<Transaction>(_context);
            var paymentRepository = new Repository.Repository<Payment>(_context);

            var featureToggleService = new Mock<IFeatureToggleService>();
            featureToggleService.Setup(_ => _.IsEnabledAsync(It.IsAny<string>(), It.IsAny<string>())).ReturnsAsync(true);

            var config = new MapperConfiguration(
                cfg =>
                {
                    cfg.ConstructServicesUsing(type => null);
                    cfg.AddMaps(typeof(MappingProfile).Assembly);
                },
                new LoggerFactory()
            );

            _transactionService = new TransactionService(
                repository,
                paymentRepository,
                config.CreateMapper(),
                featureToggleService.Object,
                Mock.Of<ILogService>()
            );
        }

        public void Dispose()
        {
            _context.Dispose();
            _connection.Dispose();
        }

        private async Task<Transaction> SeedTransactionAsync(string description, params Payment[] payments)
        {
            var transaction = new Transaction { Date = DateTime.UtcNow, Description = description };
            _context.Set<Transaction>().Add(transaction);
            await _context.SaveChangesAsync();

            foreach (var payment in payments)
            {
                payment.TransactionId = transaction.Id;
                _context.Set<Payment>().Add(payment);
            }
            await _context.SaveChangesAsync();

            return transaction;
        }

        private static Payment NewPayment(PaymentStatus status, DateTime date) =>
            new()
            {
                Status = status,
                Date = date,
                Type = PaymentType.Incoming,
                Price = 10m,
                Description = "p",
            };

        [Fact]
        public async Task FindAllPaged_StatusFilter_ShouldTranslateToSql_AndMatchApproved()
        {
            // Approved: at least one payment, all Approved.
            await SeedTransactionAsync("all-approved", NewPayment(PaymentStatus.Approved, DateTime.UtcNow));
            // Not approved: mixed, not overdue.
            await SeedTransactionAsync(
                "mixed-not-overdue",
                NewPayment(PaymentStatus.Approved, DateTime.UtcNow),
                NewPayment(PaymentStatus.Pending, DateTime.UtcNow.AddDays(1))
            );
            // No payments at all.
            await SeedTransactionAsync("no-payments");

            var result = await _transactionService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50, Statuses = new List<string> { "Approved" } }
            );

            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(1, result.Data!.TotalCount);
            Assert.Equal("all-approved", Assert.Single(result.Data.Items).Description);
        }

        [Fact]
        public async Task FindAllPaged_StatusFilter_ShouldTranslateToSql_AndMatchPending()
        {
            await SeedTransactionAsync("all-approved", NewPayment(PaymentStatus.Approved, DateTime.UtcNow));
            await SeedTransactionAsync(
                "mixed-not-overdue",
                NewPayment(PaymentStatus.Approved, DateTime.UtcNow),
                NewPayment(PaymentStatus.Pending, DateTime.UtcNow.AddDays(1))
            );
            await SeedTransactionAsync("no-payments");

            var result = await _transactionService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50, Statuses = new List<string> { "Pending" } }
            );

            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(2, result.Data!.TotalCount);
            var descriptions = result.Data.Items.Select(t => t.Description).ToList();
            Assert.Contains("mixed-not-overdue", descriptions);
            Assert.Contains("no-payments", descriptions);
        }

        [Fact]
        public async Task FindAllPaged_StatusFilter_ShouldTranslateToSql_AndMatchDelayed()
        {
            await SeedTransactionAsync("all-approved", NewPayment(PaymentStatus.Approved, DateTime.UtcNow));
            await SeedTransactionAsync(
                "mixed-overdue",
                NewPayment(PaymentStatus.Approved, DateTime.UtcNow),
                NewPayment(PaymentStatus.Pending, DateTime.UtcNow.AddDays(-5))
            );

            var result = await _transactionService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50, Statuses = new List<string> { "Delayed" } }
            );

            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(1, result.Data!.TotalCount);
            Assert.Equal("mixed-overdue", Assert.Single(result.Data.Items).Description);
        }

        [Fact]
        public async Task FindAllPaged_WithoutStatusFilter_ShouldReturnEveryTransaction()
        {
            await SeedTransactionAsync("all-approved", NewPayment(PaymentStatus.Approved, DateTime.UtcNow));
            await SeedTransactionAsync("no-payments");

            var result = await _transactionService.FindAllPaged(new PagedRequest { Page = 1, PageSize = 50 });

            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(2, result.Data!.TotalCount);
        }
    }
}
