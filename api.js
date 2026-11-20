/* Public Worker URL only. The JSONBin secret stays in Cloudflare Worker secrets. */
window.CODING_CLUB_API_URL = 'https://coding-club-api.YOUR-SUBDOMAIN.workers.dev';

(function () {
  'use strict';

  function request(path, method, data) {
    var base = (window.CODING_CLUB_API_URL || '').replace(/\/+$/, '');
    if (!base || base.indexOf('YOUR-SUBDOMAIN') !== -1) {
      return Promise.reject(new Error('The club server is not configured yet.'));
    }

    var options = { method: method, cache: 'no-store' };
    if (data !== undefined) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(data);
    }

    return fetch(base + path, options).then(function (response) {
      return response.json().catch(function () {
        throw new Error('The server returned an invalid response.');
      }).then(function (payload) {
        if (!response.ok) throw new Error(payload.error || 'The request could not be completed.');
        return payload;
      });
    }).catch(function (error) {
      if (error instanceof TypeError) {
        throw new Error('Could not connect to the club server. Please try again.');
      }
      throw error;
    });
  }

  window.ClubAPI = {
    get: function (path) { return request(path, 'GET'); },
    post: function (path, data) { return request(path, 'POST', data); }
  };
})();
