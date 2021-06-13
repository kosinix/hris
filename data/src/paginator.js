//// Core modules

//// External modules
const lodash = require('lodash');

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
    if (perPage > pagination.totalDocs) perPage = pagination.totalDocs;
    pagination.pages = Math.floor(pagination.totalDocs / perPage);
    if (pagination.totalDocs % perPage > 0) {
        pagination.pages += 1;
    }
    // Turn pages from int into array
    if (pagination.pages > 1) {
        pagination.pages = Array.from({ length: pagination.pages }, (v, k) => k + 1);
        pagination.pages = lodash.filter(pagination.pages, (p) => {
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