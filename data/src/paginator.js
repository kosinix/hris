//// Core modules

//// External modules

//// Modules


let paginate = (page, totalDocs, perPage, urlBase, existingQuery, width = 5) => {
    let pagination = {
        page: page,
        totalDocs: totalDocs,
        perPage: perPage,
        width: width,
        query: { ...existingQuery },
        urlBase: urlBase,
        pages: 0,
    }
    if(!pagination.perPage) pagination.perPage = pagination.totalDocs
    if (pagination.perPage > pagination.totalDocs) pagination.perPage = pagination.totalDocs;
    pagination.pages = Math.floor(pagination.totalDocs / pagination.perPage);
    if (pagination.totalDocs % pagination.perPage > 0) {
        pagination.pages += 1;
    }
    // Turn pages from int into array
    if (pagination.pages > 1) {
        pagination.pages = Array.from({ length: pagination.pages }, (v, k) => k + 1);
        pagination.pages = pagination.pages.filter(p => {
            if (p === 1 || p === 2 || p === pagination.pages.length || p === pagination.pages.length - 1) return true;

            return (p >= pagination.page - pagination.width && p <= pagination.page + pagination.width)

        })
    } else {
        pagination.pages = [];
    }
    return pagination;
}

module.exports = {
    paginate: paginate
}