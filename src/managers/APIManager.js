const Manager = require('../structures/Manager');
const request = require('superagent');

class APIManager extends Manager {
  constructor(client) {
    super(client);

    this.keys = this.client.config.api;
  }

  // Bing Maps
  getLocation(query, options = {}) {
    return request
      .get(`https://dev.virtualearth.net/REST/v1/Locations`)
      .query({
        query,
        maxResults: options.maxResults || 1,
        culture: options.locale || this.client.localization.defaultLocale,
        key: this.keys.bingGeocode,
      })
      .then(r => r.body)
      .catch(r => r.status || 0);
  }

  // DarkSky
  getWeather(coordinates, options = {}) {
    return request
      .get(`https://api.darksky.net/forecast/${this.keys.darkSky}/${coordinates}`)
      .query({
        exclude: options.exclude || 'minutely,hourly,alerts,flags',
        lang: options.lang || this.client.localization.defaultLocale,
        units: options.units || 'si',
      })
      .then(r => r.body)
      .catch(r => r.status || 0);
  }

  // Google
  getGoogle(query, options = {}) {
    return request
      .get(`https://www.googleapis.com/customsearch/v1`)
      .query({
        key: this.keys.googleKey,
        cx: this.keys.googleCx,
        fields: options.fields || 'queries(request(totalResults)),items(link)',
        lr: `lang_${(options.lang || this.client.localization.defaultLocale).split('-')[0]}`,
        num: options.num || 1,
        filter: options.filter || 1,
        safe: options.safe || 'high',
        q: query,
      })
      .then(r => r.body)
      .catch(r => r.status || 0);
  }

  // Radio.net
  getRadionet(station, options = {}) {
    return request
      .get(`https://api.radio.net/info/v2/search/nowplaying`)
      .query({
        apikey: this.keys.radioNet,
        numberoftitles: options.numberoftitles || 1,
        station,
      })
      .then(r => r.body)
      .catch(r => r.status || 0);
  }

  // Sight
  getNudity(url, options = {}) {
    return request
      .get('https://api.sightengine.com/1.0/check.json')
      .query({
        models: options.models || 'nudity',
        api_user: this.keys.sightUser,
        api_secret: this.keys.sightKey,
        url,
      })
      .then(r => r.body)
      .catch(r => r.status || 0);
  }

  // Tune-in
  getTunein(station) {
    return request
      .get(`https://feed.tunein.com/profiles/s${station}/nowPlaying`)
      .then(r => r.body)
      .catch(r => r.status || 0);
  }

  // YouTube
  getYoutube(query, options = {}) {
    return request
      .get(`https://www.googleapis.com/youtube/v3/search`)
      .query({
        key: this.keys.youtube,
        part: options.part || 'snippet',
        maxResults: options.maxResults || 1,
        q: query,
      })
      .then(r => r.body)
      .catch(r => r.status || 0);
  }
}

module.exports = APIManager;
