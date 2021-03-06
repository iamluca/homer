const Command = require('../../structures/Command');
const moment = require('moment-timezone');
const request = require('superagent');

class WeatherCommand extends Command {
  constructor(client) {
    super(client, {
      name: 'weather',
      usage: '<location>',
      category: 'general',
      dm: true,
    });
  }

  async execute(context) {
    const query = encodeURIComponent(context.args.join(' '));
    if (!query) return context.replyError(context.__('weather.noSearch'));
    if (query.length > 64) return context.replyWarning(context.__('weather.queryTooLong'));

    const message = await context.replyLoading(context.__('global.loading'));

    const locationData = await this.client.api.getLocation(query)
      .then((data) => {
        if (typeof data === 'number' || data.resourceSets[0].estimatedTotal === 0) return null;

        const foundLoc = data.resourceSets[0].resources[0];
        return ({
          city: foundLoc.address.locality || foundLoc.address.formattedAddress || null,
          department: foundLoc.address.adminDistrict2 || null,
          region: foundLoc.address.adminDistrict || null,
          country: foundLoc.address.countryRegion || null,
          postalcode: this.franceDepartments[foundLoc.address.adminDistrict2] || null,
          geometry: foundLoc.point.coordinates.join(','),
        });
      });
    if (!locationData) return message.edit(`${this.client.constants.emotes.warning} ${context.__('weather.unknownLocation')}`);

    const weatherData = await this.client.api.getWeather(locationData.geometry, { lang: context.settings.misc.locale.split('-')[0] });
    if (typeof weatherData === 'number') return context.replyWarning(context.__('weather.unknownError'));

    const vigilance = (locationData.country === 'France' && locationData.postalcode) ? await this.getVigilance(locationData) : '';

    const uvIndex = Math.floor(weatherData.currently.uvIndex);
    const currently = [
      `${this.dot} ${context.__('weather.embed.weather')}: **${weatherData.currently.summary}**`,
      `${this.dot} ${context.__('weather.embed.temperature')}: **${Math.floor(weatherData.currently.temperature)}**°C (**${Math.floor((weatherData.currently.temperature * 1.8) + 32)}**°F)`,
      `${this.dot} ${context.__('weather.embed.feelsLike')}: **${Math.floor(weatherData.currently.apparentTemperature)}**°C (**${Math.floor((weatherData.currently.apparentTemperature * 1.8) + 32)}**°F)`,
      //`${this.dot} ${context.__('weather.embed.precip')}: ${weatherData.currently.precipIntensity < 0.5 ? context.__('global.none') : `**${context.__(`weather.precip.${weatherData.currently.precipType}`)}** - **${Math.floor(weatherData.currently.precipIntensity * 100) / 100}**mm/h (**${Math.floor((weatherData.currently.precipIntensity / 25.4) * 100) / 100}**in/h)`}`,
      `${this.dot} ${context.__('weather.embed.wind')}: **${context.__(`weather.wind.${this.getDirection(weatherData.currently.windBearing)}`)}** - **${Math.floor(weatherData.currently.windSpeed)}**${context.__('weather.units.kph')} (**${Math.floor(weatherData.currently.windSpeed / 1.609)}**${context.__('weather.units.mph')})`,
      `${this.dot} ${context.__('weather.embed.uv')}: **${uvIndex}** (**${context.__(`weather.uv.${this.getUvLevel(uvIndex)}`)}**)`,
      `${this.dot} ${context.__('weather.embed.pressure')}: **${Math.floor(weatherData.currently.pressure)}**hPa`,
      `${this.dot} ${context.__('weather.embed.humidity')}: **${Math.floor(weatherData.currently.humidity * 100)}**%`,
      `${this.dot} ${context.__('weather.embed.nebulosity')}: **${Math.floor(weatherData.currently.cloudCover * 100)}**%`,
      vigilance,
    ].join('\n');

    const entries = [currently];
    const pages = [{
      title: context.__('weather.currently'),
      thumb: `${this.client.constants.CDN}/assets/weather/${weatherData.currently.icon}.png`,
    }];

    for (let i = 0; i < weatherData.daily.data.length; i += 1) {
      const item = weatherData.daily.data[i];
      const uv = Math.floor(item.uvIndex);

      let title = null;
      switch (i) {
        case 0:
          title = context.__('weather.today');
          break;
        case 1:
          title = context.__('weather.tomorrow');
          break;
        default:
          title = moment.tz((item.time * 1000), weatherData.timezone)
            .locale(context.settings.misc.locale)
            .tz(weatherData.timezone)
            .format(context.__('weather.dayFormat'));
          break;
      }

      pages.push({ title, thumb: `${this.client.constants.CDN}/assets/weather/${item.icon}.png` });

      // Moon phase
      // Moon phase
      // 0.95 > x > 0.05: new moon | 0.05 > x > 0.25: waxing crescent | 0.20 > x 0.30: first quarter | 0.30 > x > 0.45: waxing gibbous
      // 0.45 > x > 0.55: full moon | 0.55 > x > 0.70: waning gibbous | 0.70 > x > 0.80: last quarter | 0.75 > x > 0.95: waning crescent
      const moon = this.getMoon(item.moonPhase);

      entries.push([
        `${this.dot} ${context.__('weather.embed.weather')}: **${item.summary}**`,
        `${this.dot} ${context.__('weather.embed.temperature')}: ${context.__('weather.embed.temperatures', {
          min: Math.floor(item.temperatureMin), max: Math.floor(item.temperatureMax),
          minF: Math.floor((item.temperatureMin * 1.8) + 32), maxF: Math.floor((item.temperatureMax * 1.8) + 32),
        })}`,
        `${this.dot} ${context.__('weather.embed.wind')}: **${context.__(`weather.wind.${this.getDirection(item.windBearing)}`)}** - **${Math.floor(item.windSpeed)}**${context.__('weather.units.kph')} (**${Math.floor(item.windSpeed / 1.609)}**${context.__('weather.units.mph')})`,
        `${this.dot} ${context.__('weather.embed.uv')}: **${uv}** (**${context.__(`weather.uv.${this.getUvLevel(uv)}`)}**)`,
        `${this.dot} ${context.__('weather.embed.humidity')}: **${Math.floor(item.humidity * 100)}**%`,
        `${this.dot} ${context.__('weather.embed.pressure')}: **${Math.floor(item.pressure)}**hPa`,
        `${this.dot} ${context.__('weather.embed.sunrise')}: **${moment(item.sunriseTime * 1000).tz(weatherData.timezone).format('HH:mm')}** - ${context.__('weather.embed.sunset')}: **${moment(item.sunsetTime * 1000).locale(context.settings.misc.locale).tz(weatherData.timezone).format('HH:mm')}**`,
        `${this.dot} ${context.__('weather.embed.moon')}: ${moon[0]} **${context.__(`weather.moon.${moon[1]}`)}**`,
      ].join('\n'));
    }

    const region = [locationData.region, locationData.country]
      .filter(a => a)
      .join(', ');

    this.client.menu.createMenu(
      context.message.channel.id,
      context.message.author.id,
      context.message.id,
      context.settings.misc.locale,
      context.__('weather.title', { location: `**${locationData.city || context.__('global.unknown')}**${region ? ` (${region})` : ''}` }),
      pages,
      entries,
      { entriesPerPage: 1, footer: `${context.__('weather.embed.footer.location')} Bing™ Maps • ${context.__('weather.embed.footer.weather')} DarkSky™` },
    );

    message.delete();

    /*// Météo-France weather alerts (only for Metropolitain France territory)
    if (locationData.country === 'France' && locationData.postalcode) {
      const alertData = await request.get('http://api.meteofrance.com/files/vigilance/vigilance.json')
        .then(res => res.body);

      const meta = alertData.meta.find(m => m.zone === 'FR');
      const dept = alertData.data
        .find(d => locationData.postalcode === d.department);
      if (!dept || dept.level < 2) return;

      const embedColors = {
        2: 0xFFFF00,
        3: 0xFF8000,
        4: 0xFF0000,
      };

      const alerts = dept.risk
        .map((level, index) => (level >= 2 ? meta.riskNames[index] : null))
        .filter(a => a)
        .join(' - ');

      const alertEmbed = new RichEmbed()
        .setDescription(`**VIGILANCE ${meta.colLevels[dept.level - 1]}**\nPhénomènes dangereux dans le département **${locationData.department || ctx.__('global.unknown')}**.\n${alerts}\n\nPour plus d'informations consultez la [carte de vigilance](http://vigilance.meteofrance.com).`)
        .setThumbnail(`http://api.meteofrance.com/files/vigilance/${meta.vignette}?anticache=${Date.now()}`)
        .setFooter(
          `Émission: ${context.formatDate(meta.dates.dateInsertion)} - Fin: ${context.formatDate(meta.dates.datePrevue)}`,
          'http://www.meteofrance.com/favicon.ico',
        )
        .setColor(embedColors[dept.level]);

      context.reply({ embed: alertEmbed });
    }*/
  }

  getDirection(angle) {
    const arrayIndex = Number((angle / 22.5) + 0.5);
    return Math.round(arrayIndex % 15);
  }

  getUvLevel(index) {
    if (index <= 2) return 'low';
    if (index >= 3 && index <= 5) return 'medium';
    if (index >= 6 && index <= 7) return 'high';
    if (index >= 8 && index <= 10) return 'veryHigh';
    if (index >= 11) return 'extreme';
    return 'na';
  }

  getMoon(index) {
    if (index > 0.95 || index <= 0.05) return ['🌑', 'new'];
    else if (index > 0.05 && index <= 0.20) return ['🌒', 'waxingCrescent'];
    else if (index > 0.20 && index <= 0.30) return ['🌓', 'firstQuarter'];
    else if (index > 0.30 && index <= 0.45) return ['🌔', 'waxingGibbous'];
    else if (index > 0.45 && index <= 0.55) return ['🌕', 'full'];
    else if (index > 0.55 && index <= 0.70) return ['🌖', 'waningGibbous'];
    else if (index > 0.70 && index <= 0.80) return ['🌗', 'lastQuarter'];
    return ['🌘', 'waningCrescent'];
  }

  async getVigilance(locationData) {
    const alertData = await request.get('http://api.meteofrance.com/files/vigilance/vigilance.json')
      .then(res => res.body);

    const dept = alertData.data
      .find(d => locationData.postalcode === d.department);
    if (!dept) return;

    const alerts = dept.risk
      .map((level, index) => this.client.constants.vigilances[`${this.riskType[index]}_${this.riskLevel[level - 1]}`])
      .filter(a => a)
      .join('-');

    return `${this.client.constants.vigilances.meteofrance} [Vigilance](http://vigilance.meteofrance.com) **[${dept.department || ctx.__('global.unknown')}](http://vigilance.meteofrance.com/Bulletin.html?a=dept${dept.department}&b=)**: ${alerts}`;
  }

  get riskType() {
    return ['vent', 'inondation', 'orage', 'crue', 'neige', 'chaud', 'froid', 'avalanche', 'vague'];
  }

  get riskLevel() {
    return ['vert', 'jaune', 'orange', 'rouge'];
  }

  get franceDepartments() {
    return ({
      Aube: '10',
      Aude: '11',
      Aveyron: '12',
      'Bouches-du-Rhône': '13',
      Calvados: '14',
      Cantal: '15',
      Charente: '16',
      'Charente-Maritime': '17',
      Cher: '18',
      Corrèze: '19',
      'Côte-d\'Or': '21',
      'Côtes-d\'Armor': '22',
      Creuse: '23',
      Dordogne: '24',
      Doubs: '25',
      Drôme: '26',
      Eure: '27',
      'Eure-et-Loir': '28',
      Finistère: '29',
      Gard: '30',
      'Haute-Garonne': '31',
      Gers: '32',
      Gironde: '33',
      Hérault: '34',
      'Ille-et-Vilaine': '35',
      Indre: '36',
      'Indre-et-Loire': '37',
      Isère: '38',
      Jura: '39',
      Landes: '40',
      'Loir-et-Cher': '41',
      Loire: '42',
      'Haute-Loire': '43',
      'Loire-Atlantique': '44',
      Loiret: '45',
      Lot: '46',
      'Lot-et-Garonne': '47',
      Lozère: '48',
      'Maine-et-Loire': '49',
      Manche: '50',
      Marne: '51',
      'Haute-Marne': '52',
      Mayenne: '53',
      'Meurthe-et-Moselle': '54',
      Meuse: '55',
      Morbihan: '56',
      Moselle: '57',
      Nièvre: '58',
      Nord: '59',
      Oise: '60',
      Orne: '61',
      'Pas-de-Calais': '62',
      'Puy-de-Dôme': '63',
      'Pyrénées Atlantiques': '64',
      'Hautes-Pyrénées': '65',
      'Pyrénées-Orientales': '66',
      'Bas-Rhin': '67',
      'Haut-Rhin': '68',
      Rhône: '69',
      'Haute-Saône': '70',
      'Saône-et-Loire': '71',
      Sarthe: '72',
      Savoie: '73',
      'Haute-Savoie': '74',
      'Ville de Paris': '75',
      'Seine-Maritime': '76',
      'Seine-et-Marne': '77',
      Yvelines: '78',
      'Deux-Sèvres': '79',
      Somme: '80',
      Tarn: '81',
      'Tarn-et-Garonne': '82',
      Var: '83',
      Vaucluse: '84',
      Vendée: '85',
      Vienne: '86',
      'Haute-Vienne': '87',
      Vosges: '88',
      Yonne: '89',
      'Territoire de Belfort': '90',
      Essonne: '91',
      'Hauts-de-Seine': '92',
      'Seine-Saint-Denis': '93',
      'Val-de-Marne': '94',
      'Val-d\'Oise': '95',
      Guadeloupe: '971',
      Martinique: '972',
      Guyane: '973',
      Réunion: '974',
      'Saint Pierre et Miquelon': '975',
      Mayotte: '976',
      Ain: '01',
      Aisne: '02',
      Allier: '03',
      'Alpes-de-Haute-Provence': '04',
      'Hautes-Alpes': '05',
      'Alpes-Maritimes': '06',
      Ardèche: '07',
      Ardennes: '08',
      Ariège: '09',
      'Corse-du-Sud': '2A',
      'Haute-Corse': '2B',
    });
  }
}

module.exports = WeatherCommand;
