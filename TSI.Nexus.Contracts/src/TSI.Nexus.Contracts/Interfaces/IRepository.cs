using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;

namespace TSI.Nexus.Contracts.Interfaces
{
    public interface IRepository<T>
        where T : class
    {
        /// <summary>
        /// This function will be receive an object as parameter and should be add it to the database.
        /// </summary>
        /// <param name="entity">The entity object to be added.</param>
        Task AddAsync(T entity);

        /// <summary>
        /// This function will be receive a range of objects as parameter and should add them all to the
        /// database in a single SaveChangesAsync() call, instead of one save per entity.
        /// </summary>
        /// <param name="entities">The entity objects to be added.</param>
        Task AddRangeAsync(IEnumerable<T> entities);

        /// <summary>
        /// This function will be receive an object as parameter and should be update it to the database.
        /// </summary>
        /// <param name="entity">The entity object to be updated.</param>
        Task UpdateAsync(T entity);

        /// <summary>
        /// This function will be receive a rango of object as parameter and should be update them into the database.
        /// </summary>
        /// <param name="entity">A list of entity objects to be updated.</param>
        Task UpdateRangeAsync(IEnumerable<T> entities);

        /// <summary>
        /// This function will be receive an object as parameter and should be remove it to the database.
        /// </summary>
        /// <param name="entity">The entity object to be removed.</param>
        Task RemoveAsync(T entity);

        /// <summary>
        /// This function will be not receive parameter and should be returns all registers found in this entity.
        /// </summary>
        /// <returns>Returns all registers found in this entity.</returns>
        Task<IList<T>> GetAllAsync();

        /// <summary>
        /// This function will be not receive parameter and should be returns all registers found in this entity.
        /// Pass true to skip EF Core change tracking for a purely read-only result (e.g. a list/grid
        /// endpoint that never saves the entities back), avoiding the tracking overhead on every row.
        /// </summary>
        /// <param name="asNoTracking">When true, the result is not tracked by the change tracker.</param>
        /// <returns>Returns all registers found in this entity.</returns>
        Task<IList<T>> GetAllAsync(bool asNoTracking);

        /// <summary>
        /// This function will be not receive parameter and should be returns all registers found in this entity.
        /// Pass true to skip EF Core change tracking for a purely read-only result (e.g. a list/grid
        /// endpoint that never saves the entities back), avoiding the tracking overhead on every row.
        /// </summary>
        /// <param name="asNoTracking">When true, the result is not tracked by the change tracker.</param>
        /// <param name="includes">The objects to be included in the search.</param>
        /// <returns>Returns all registers found in this entity.</returns>
        Task<IList<T>> GetAllAsync(bool asNoTracking, params Expression<Func<T, object>>[] includes);

        /// <summary>
        /// This function will be not receive parameter and should be returns all registers found in this entity.
        /// Pass true for splitQuery when includes combine two or more collection navigations (e.g.
        /// Order.OrderProducts + Order.Payments) - a single query with several Include()s on
        /// collections produces a cross-join whose row count multiplies with every extra collection,
        /// even though it collapses back correctly client-side. AsSplitQuery() issues one query per
        /// collection instead, avoiding that blowup.
        /// </summary>
        /// <param name="asNoTracking">When true, the result is not tracked by the change tracker.</param>
        /// <param name="splitQuery">When true, EF Core issues one query per collection include instead of a single joined query.</param>
        /// <param name="includes">The objects to be included in the search.</param>
        /// <returns>Returns all registers found in this entity.</returns>
        Task<IList<T>> GetAllAsync(
            bool asNoTracking,
            bool splitQuery,
            params Expression<Func<T, object>>[] includes
        );

        /// <summary>
        /// This function will be not receive parameter and should be returns all registers found in this entity.
        /// </summary>
        /// <param name="includes">The objects to be included in the search.</param>
        /// <returns>Returns all registers found in this entity.</returns>
        Task<IList<T>> GetAllAsync(params Expression<Func<T, object>>[] includes);

        /// <summary>
        /// This function will be receive the "ID" as parameter and should be returns the object found.
        /// </summary>
        /// <param name="id">The ID value to be used on the search.</param>
        /// <returns>Returns the object found</returns>
        Task<T> GetByIdAsync(object id);

        /// <summary>
        /// This function will be receive the "ID" as parameter and should be returns the object found.
        /// Pass true to skip EF Core change tracking for a purely read-only result (e.g. a details
        /// endpoint that never saves the entity back), avoiding the tracking overhead.
        /// </summary>
        /// <param name="id">The ID value to be used on the search.</param>
        /// <param name="asNoTracking">When true, the result is not tracked by the change tracker.</param>
        /// <returns>Returns the object found</returns>
        Task<T> GetByIdAsync(object id, bool asNoTracking);

        /// <summary>
        /// This function will be receive the "ID" as parameter and should be returns the object found.
        /// </summary>
        /// <param name="id">The ID value to be used on the search.</param>
        /// <param name="includes">The objects to be included in the search.</param>
        /// <returns></returns>
        Task<T> GetByIdAsync(object id, params Expression<Func<T, object>>[] includes);

        /// <summary>
        /// This function will be receive the "ID" as parameter and should be returns the object found.
        /// Pass true to skip EF Core change tracking for a purely read-only result (e.g. a details
        /// endpoint that never saves the entity back), avoiding the tracking overhead.
        /// </summary>
        /// <param name="id">The ID value to be used on the search.</param>
        /// <param name="asNoTracking">When true, the result is not tracked by the change tracker.</param>
        /// <param name="includes">The objects to be included in the search.</param>
        /// <returns>Returns the object found</returns>
        Task<T> GetByIdAsync(
            object id,
            bool asNoTracking,
            params Expression<Func<T, object>>[] includes
        );

        /// <summary>
        /// This function will be receive the "ID" as parameter and should be returns the object found.
        /// Pass true for splitQuery when includes combine two or more collection navigations (e.g.
        /// Order.OrderProducts + Order.Payments) - a single query with several Include()s on
        /// collections produces a cross-join whose row count multiplies with every extra collection,
        /// even though it collapses back correctly client-side. AsSplitQuery() issues one query per
        /// collection instead, avoiding that blowup.
        /// </summary>
        /// <param name="id">The ID value to be used on the search.</param>
        /// <param name="asNoTracking">When true, the result is not tracked by the change tracker.</param>
        /// <param name="splitQuery">When true, EF Core issues one query per collection include instead of a single joined query.</param>
        /// <param name="includes">The objects to be included in the search.</param>
        /// <returns>Returns the object found</returns>
        Task<T> GetByIdAsync(
            object id,
            bool asNoTracking,
            bool splitQuery,
            params Expression<Func<T, object>>[] includes
        );

        /// <summary>
        /// This function will be receive the "Name" as parameter and should be returns the object found.
        /// </summary>
        /// <param name="name">The Name value to be used on the search.</param>
        /// <returns>Returns the object found</returns>
        Task<T> GetByNameAsync(string name);

        /// <summary>
        /// This function will be receive an expression as parameter and should be returns true if any object found.
        /// </summary>
        /// <param name="filter">The filter expression to be used on the search.</param>
        /// <returns>Returns true if any object found matching the filter.</returns>
        Task<bool> AnyAsync(Expression<Func<T, bool>> filter);

        /// <summary>
        /// This function will be receive an expression as parameter and should be returns the first object found.
        /// </summary>
        /// <param name="filter">The filter expression to be used on the search.</param>
        /// <returns>Returns the first object found matching the filter.</returns>
        Task<T> FirstOrDefaultAsync(Expression<Func<T, bool>> filter);

        /// <summary>
        /// This function will be receive an expression as parameter and should be returns the first object found.
        /// Pass true to skip EF Core change tracking for a purely read-only result (e.g. a details
        /// endpoint that never saves the entity back), avoiding the tracking overhead.
        /// </summary>
        /// <param name="filter">The filter expression to be used on the search.</param>
        /// <param name="asNoTracking">When true, the result is not tracked by the change tracker.</param>
        /// <returns>Returns the first object found matching the filter.</returns>
        Task<T> FirstOrDefaultAsync(Expression<Func<T, bool>> filter, bool asNoTracking);

        /// <summary>
        /// This function will be receive an expression as parameter and should be returns the first object found.
        /// </summary>
        /// <param name="filter">The filter expression to be used on the search.</param>
        /// <param name="includes">The objects to be included in the search.</param>
        /// <returns>Returns the first object found matching the filter.</returns>
        Task<T> FirstOrDefaultAsync(
            Expression<Func<T, bool>> filter,
            params Expression<Func<T, object>>[] includes
        );

        /// <summary>
        /// This function will be receive an expression as parameter and should be returns the first object found.
        /// Pass true to skip EF Core change tracking for a purely read-only result (e.g. a details
        /// endpoint that never saves the entity back), avoiding the tracking overhead.
        /// </summary>
        /// <param name="filter">The filter expression to be used on the search.</param>
        /// <param name="asNoTracking">When true, the result is not tracked by the change tracker.</param>
        /// <param name="includes">The objects to be included in the search.</param>
        /// <returns>Returns the first object found matching the filter.</returns>
        Task<T> FirstOrDefaultAsync(
            Expression<Func<T, bool>> filter,
            bool asNoTracking,
            params Expression<Func<T, object>>[] includes
        );

        /// <summary>
        /// This function will be receive na expression as parameter and should be returns results from the execute.
        /// </summary>
        /// <param name="filter">The filter expression to be used on the search.</param>
        /// <returns>Returns a list with the objects found on the execution.</returns>
        Task<IList<T>> QueryAsync(Expression<Func<T, bool>> filter);

        /// <summary>
        /// This function will be receive na expression as parameter and should be returns results from the execute.
        /// Pass true to skip EF Core change tracking for a purely read-only result (e.g. a list/grid
        /// endpoint that never saves the entities back), avoiding the tracking overhead on every row.
        /// </summary>
        /// <param name="filter">The filter expression to be used on the search.</param>
        /// <param name="asNoTracking">When true, the result is not tracked by the change tracker.</param>
        /// <returns>Returns a list with the objects found on the execution.</returns>
        Task<IList<T>> QueryAsync(Expression<Func<T, bool>> filter, bool asNoTracking);

        /// <summary>
        /// This function will be receive na expression as parameter and should be returns results from the execute.
        /// Pass true to skip EF Core change tracking for a purely read-only result (e.g. a list/grid
        /// endpoint that never saves the entities back), avoiding the tracking overhead on every row.
        /// </summary>
        /// <param name="filter">The filter expression to be used on the search.</param>
        /// <param name="asNoTracking">When true, the result is not tracked by the change tracker.</param>
        /// <param name="includes">The objects to be included in the search.</param>
        /// <returns>Returns a list with the objects found on the execution.</returns>
        Task<IList<T>> QueryAsync(
            Expression<Func<T, bool>> filter,
            bool asNoTracking,
            params Expression<Func<T, object>>[] includes
        );

        /// <summary>
        /// This function will be receive na expression as parameter and should be returns results from the execute.
        /// </summary>
        /// <param name="filter">The filter expression to be used on the search.</param>
        /// <param name="includes">The objects to be included in the search.</param>
        /// <returns>Returns a list with the objects found on the execution.</returns>
        Task<IList<T>> QueryAsync(
            Expression<Func<T, bool>> filter,
            params Expression<Func<T, object>>[] includes
        );

        /// <summary>
        /// This function will be receive an expression as parameter and should be returns the sum of the values.
        /// </summary>
        /// <param name="filter">The filter expression to be used on the search.</param>
        /// <param name="selector">The selector expression to specify the property to be summed.</param>
        /// <returns>Returns the sum of the values.</returns>
        Task<decimal> SumAsync(Expression<Func<T, bool>> filter, Expression<Func<T, decimal>> selector);

        /// <summary>
        /// This function will be receive an expression as parameter and should be returns the count of the items.
        /// </summary>
        /// <param name="filter">The filter expression to be used on the search.</param>
        /// <returns>Returns the count of the items.</returns>
        Task<int> CountAsync(Expression<Func<T, bool>> filter);

        /// <summary>
        /// Execute a bulk update on entities matching the filter. The updateAction will be applied to each entity.
        /// Implementations may translate this to a single UPDATE statement when possible, otherwise they may load
        /// the entities, apply the action and save changes. Returns the number of rows affected.
        /// </summary>
        Task<int> ExecuteUpdateAsync(Expression<Func<T, bool>> filter, Action<T> updateAction);

        /// <summary>
        /// Returns one page of results plus the total row count matching <paramref name="filter"/>
        /// (counted before Skip/Take, on the unfiltered-by-Include query - joining in the Include
        /// navigations would multiply the count). Backs server-side pagination (ag-Grid Infinite
        /// Row Model) for the highest-volume listings, where loading the entire table per request
        /// isn't viable. <paramref name="orderBy"/> lets the caller pick the sort column since the
        /// generic repository has no notion of which columns a given entity's grid exposes; when
        /// null, falls back to the same CreateDate ordering every other repository method uses.
        /// </summary>
        /// <param name="skip">Number of matching rows to skip.</param>
        /// <param name="take">Number of rows to return after skipping.</param>
        /// <param name="filter">Optional filter expression; null returns all rows.</param>
        /// <param name="orderBy">Optional ordering function; null falls back to CreateDate ascending.</param>
        /// <param name="asNoTracking">When true, the result is not tracked by the change tracker.</param>
        /// <param name="includes">The objects to be included in the search.</param>
        /// <returns>The page of items and the total matching row count.</returns>
        Task<(IList<T> Items, int TotalCount)> GetPagedAsync(
            int skip,
            int take,
            Expression<Func<T, bool>> filter,
            Func<IQueryable<T>, IOrderedQueryable<T>> orderBy,
            bool asNoTracking,
            params Expression<Func<T, object>>[] includes
        );
    }
}
