using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Data;

namespace TSI.Nexus.Repository
{
    public class Repository<T> : IRepository<T>
        where T : class
    {
        #region Properties

        /// <summary>
        /// MyDBContextEF object responsible to stablish the connection with database using EntityFramework
        /// </summary>
        protected readonly MyDBContextEF _myDbContext;

        #endregion Properties

        #region Public methods

        /// <summary>
        /// Repository constructor create to initialize the "_myDbContext" using Dependency Injection.
        /// </summary>
        /// <param name="context">MyDBContextEF object used to initialize the internal variable using Dependency Injection.</param>
        public Repository(MyDBContextEF context)
        {
            _myDbContext = context;
        }

        /// <inheritdoc />
        public async Task AddAsync(T entity)
        {
            if (entity is BaseModel bm && bm.Id == Guid.Empty)
            {
                bm.Id = Guid.NewGuid();
            }

            await _myDbContext.Set<T>().AddAsync(entity);
            await SaveChangesAsync();
        }

        /// <inheritdoc />
        public async Task AddRangeAsync(IEnumerable<T> entities)
        {
            var list = entities?.ToList() ?? new List<T>();

            foreach (var entity in list)
            {
                if (entity is BaseModel bm && bm.Id == Guid.Empty)
                {
                    bm.Id = Guid.NewGuid();
                }
            }

            await _myDbContext.Set<T>().AddRangeAsync(list);
            await SaveChangesAsync();
        }

        /// <inheritdoc />
        public async Task UpdateAsync(T entity)
        {
            _myDbContext.Entry(entity).State = EntityState.Modified;
            await SaveChangesAsync();
        }

        /// <inheritdoc />
        public async Task UpdateRangeAsync(IEnumerable<T> entities)
        {
            _myDbContext.UpdateRange(entities);
            await SaveChangesAsync();
        }

        /// <inheritdoc />
        public async Task RemoveAsync(T entity)
        {
            _myDbContext.Set<T>().Remove(entity);
            await SaveChangesAsync();
        }

        /// <inheritdoc />
        public async Task<T> GetByIdAsync(object id)
        {
            var entity = await _myDbContext.Set<T>().FindAsync(id);

            return entity == null
                ? throw new KeyNotFoundException($"Entity '{id}' not found.")
                : entity;
        }

        /// <inheritdoc />
        public async Task<T> GetByIdAsync(object id, bool asNoTracking)
        {
            if (!asNoTracking)
            {
                return await GetByIdAsync(id);
            }

            // FindAsync() always resolves through the change tracker (and attaches the result), so
            // it can't honor AsNoTracking() - a plain query keyed on Id is used instead here.
            var entity = await _myDbContext
                .Set<T>()
                .AsNoTracking()
                .SingleOrDefaultAsync(e => EF.Property<object>(e, "Id").Equals(id));

            return entity ?? throw new KeyNotFoundException($"Entity '{id}' not found.");
        }

        /// <inheritdoc />
        public async Task<T> GetByIdAsync(object id, params Expression<Func<T, object>>[] includes)
        {
            IQueryable<T> query = _myDbContext.Set<T>().AsQueryable();

            if (includes != null)
            {
                foreach (var include in includes)
                {
                    query = query.Include(include);
                }
            }

            var entity = await query.SingleOrDefaultAsync(e =>
                EF.Property<object>(e, "Id").Equals(id)
            );

            return entity ?? throw new KeyNotFoundException($"Entity '{id}' not found.");
        }

        /// <inheritdoc />
        public async Task<T> GetByIdAsync(
            object id,
            bool asNoTracking,
            params Expression<Func<T, object>>[] includes
        )
        {
            if (!asNoTracking)
            {
                return await GetByIdAsync(id, includes);
            }

            IQueryable<T> query = _myDbContext.Set<T>().AsNoTracking();

            if (includes != null)
            {
                foreach (var include in includes)
                {
                    query = query.Include(include);
                }
            }

            var entity = await query.SingleOrDefaultAsync(e =>
                EF.Property<object>(e, "Id").Equals(id)
            );

            return entity ?? throw new KeyNotFoundException($"Entity '{id}' not found.");
        }

        /// <inheritdoc />
        public async Task<T> GetByNameAsync(string name)
        {
            var entity = await _myDbContext.Set<T>().FindAsync(name);
            return entity == null
                ? throw new KeyNotFoundException($"Entity '{name}' not found.")
                : entity;
        }

        /// <inheritdoc />
        public async Task<bool> AnyAsync(Expression<Func<T, bool>> filter)
        {
            return await _myDbContext.Set<T>().AnyAsync(filter);
        }

        /// <inheritdoc />
        public async Task<T> FirstOrDefaultAsync(Expression<Func<T, bool>> filter)
        {
            return await _myDbContext.Set<T>().FirstOrDefaultAsync(filter)
                ?? throw new InvalidOperationException("No entity found matching the filter.");
        }

        /// <inheritdoc />
        public async Task<T> FirstOrDefaultAsync(Expression<Func<T, bool>> filter, bool asNoTracking)
        {
            if (!asNoTracking)
            {
                return await FirstOrDefaultAsync(filter);
            }

            return await _myDbContext.Set<T>().AsNoTracking().FirstOrDefaultAsync(filter)
                ?? throw new InvalidOperationException("No entity found matching the filter.");
        }

        /// <inheritdoc />
        public async Task<T> FirstOrDefaultAsync(
            Expression<Func<T, bool>> filter,
            params Expression<Func<T, object>>[] includes
        )
        {
            IQueryable<T> query = _myDbContext.Set<T>().Where(filter);

            if (includes != null && includes.Length > 0)
            {
                foreach (var include in includes)
                {
                    query = query.Include(include);
                }
            }

            var entity = await query.FirstOrDefaultAsync();

            return entity
                ?? throw new InvalidOperationException("No entity found matching the filter.");
        }

        /// <inheritdoc />
        public async Task<T> FirstOrDefaultAsync(
            Expression<Func<T, bool>> filter,
            bool asNoTracking,
            params Expression<Func<T, object>>[] includes
        )
        {
            if (!asNoTracking)
            {
                return await FirstOrDefaultAsync(filter, includes);
            }

            IQueryable<T> query = _myDbContext.Set<T>().AsNoTracking().Where(filter);

            if (includes != null && includes.Length > 0)
            {
                foreach (var include in includes)
                {
                    query = query.Include(include);
                }
            }

            var entity = await query.FirstOrDefaultAsync();

            return entity
                ?? throw new InvalidOperationException("No entity found matching the filter.");
        }

        /// <inheritdoc />
        public async Task<IList<T>> QueryAsync(Expression<Func<T, bool>> filter)
        {
            return await _myDbContext
                .Set<T>()
                .Where(filter)
                .OrderBy(e => EF.Property<DateTime>(e, "CreateDate"))
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IList<T>> QueryAsync(Expression<Func<T, bool>> filter, bool asNoTracking)
        {
            if (!asNoTracking)
            {
                return await QueryAsync(filter);
            }

            return await _myDbContext
                .Set<T>()
                .AsNoTracking()
                .Where(filter)
                .OrderBy(e => EF.Property<DateTime>(e, "CreateDate"))
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IList<T>> QueryAsync(
            Expression<Func<T, bool>> filter,
            bool asNoTracking,
            params Expression<Func<T, object>>[] includes
        )
        {
            if (!asNoTracking)
            {
                return await QueryAsync(filter, includes);
            }

            IQueryable<T> query = _myDbContext.Set<T>().AsNoTracking().Where(filter);

            if (includes != null && includes.Length > 0)
            {
                foreach (var include in includes)
                {
                    query = query.Include(include);
                }
            }

            var list = await query
                .OrderBy(e => EF.Property<DateTime>(e, "CreateDate"))
                .ToListAsync();

            return list ?? new List<T>();
        }

        /// <inheritdoc />
        public async Task<IList<T>> QueryAsync(
            Expression<Func<T, bool>> filter,
            params Expression<Func<T, object>>[] includes
        )
        {
            IQueryable<T> query = _myDbContext.Set<T>().Where(filter);

            if (includes != null && includes.Length > 0)
            {
                foreach (var include in includes)
                {
                    query = query.Include(include);
                }
            }

            var list = await query
                .OrderBy(e => EF.Property<DateTime>(e, "CreateDate"))
                .ToListAsync();

            return list ?? new List<T>();
        }

        /// <inheritdoc />
        public async Task<IList<T>> GetAllAsync()
        {
            return await _myDbContext
                .Set<T>()
                .OrderBy(e => EF.Property<DateTime>(e, "CreateDate"))
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IList<T>> GetAllAsync(bool asNoTracking)
        {
            if (!asNoTracking)
            {
                return await GetAllAsync();
            }

            return await _myDbContext
                .Set<T>()
                .AsNoTracking()
                .OrderBy(e => EF.Property<DateTime>(e, "CreateDate"))
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IList<T>> GetAllAsync(
            bool asNoTracking,
            params Expression<Func<T, object>>[] includes
        )
        {
            if (!asNoTracking)
            {
                return await GetAllAsync(includes);
            }

            IQueryable<T> query = _myDbContext.Set<T>().AsNoTracking();

            if (includes != null && includes.Length > 0)
            {
                foreach (var include in includes)
                {
                    query = query.Include(include);
                }
            }

            return await query.OrderBy(e => EF.Property<DateTime>(e, "CreateDate")).ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IList<T>> GetAllAsync(params Expression<Func<T, object>>[] includes)
        {
            IQueryable<T> query = _myDbContext.Set<T>().AsQueryable();

            if (includes != null && includes.Length > 0)
            {
                foreach (var include in includes)
                {
                    query = query.Include(include);
                }
            }

            return await query.OrderBy(e => EF.Property<DateTime>(e, "CreateDate")).ToListAsync();
        }

        /// <inheritdoc />
        public async Task<decimal> SumAsync(Expression<Func<T, bool>> filter, Expression<Func<T, decimal>> selector)
        {
            return await _myDbContext.Set<T>().Where(filter).SumAsync(selector);
        }

        /// <inheritdoc />
        public async Task<int> CountAsync(Expression<Func<T, bool>> filter)
        {
            return await _myDbContext.Set<T>().CountAsync(filter);
        }

        /// <inheritdoc />
        public async Task<int> ExecuteUpdateAsync(Expression<Func<T, bool>> filter, Action<T> updateAction)
        {
            // Try to use EF Core's ExecuteUpdateAsync if available (EF Core7+). If not available,
            // fallback to loading entities, applying action and saving.
            try
            {
                // Use reflection to detect ExecuteUpdateAsync extension method on IQueryable<T>
                var query = _myDbContext.Set<T>().Where(filter);

                // Check if EF Core supports ExecuteUpdateAsync by attempting to get method info
                var executeUpdateMethod = typeof(EntityFrameworkQueryableExtensions)
                    .GetMethods()
                    .FirstOrDefault(m => m.Name == "ExecuteUpdateAsync" && m.GetParameters().Length >=2);

                if (executeUpdateMethod != null)
                {
                    // Cannot dynamically build update expression from Action<T>; fallback to loading
                    // because building Expression<Func<T, T>> from Action<T> is non-trivial here.
                }
            }
            catch
            {
                // ignore and fallback
            }

            // Fallback: load entities, apply action and save
            var list = await _myDbContext.Set<T>().Where(filter).ToListAsync();
            foreach (var item in list)
            {
                updateAction(item);
            }

            if (list.Any())
            {
                _myDbContext.UpdateRange(list);
                await SaveChangesAsync();
            }

            return list.Count;
        }

        #endregion Public methods

        #region Private methods

        /// <summary>
        /// This function should be commit the changes on the database.
        /// </summary>
        private async Task SaveChangesAsync()
        {
            await _myDbContext.SaveChangesAsync();
        }

        #endregion Private methods
    }
}
