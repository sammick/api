const delay = require('delay');
var dayjs = require('dayjs');

module.exports = {
    logout: function(req, res, next) {
        if (!req.session.username) {
          next();
        } else {
          req.session.error = 'Only Logout - denied!';
          res.redirect('/');
        }
    },
    getRndInteger: function(max, min) {
      return Math.floor(Math.random() * (max - min + 1) ) + min;
    },
    async delay(second = 5, r = false) {  
      second *= 60;
      var min = second/2,
          max = second/2 + second;
      if( r ) return {min, max}
      return new Promise(async (resolve, reject) => {
        await delay(this.getRndInteger(max,min))
        resolve("done!");
      });
    },
    restrict: function(req, res, next) {
        console.log(req.session);
        if (req.session.username) {
          next();
        } else {
          req.session.error = 'Access denied!';
          res.redirect('/login');
        }
    },
    db: {
      get_or_set(property = '', value = '', db){
        db.has(property) || db.set(property, value).write()
        return property;
      },
      push(property, value, db) {
        db.get(this.db.get_or_set('likes', [], db)).write()
      }
    },
    abu_ekey(key, array, d = ''){
      return key in array ? array[key] : d;
    },
    short(o){
      var ordered = {};
      Object.keys(o).sort().forEach(function(key) {
        ordered[key] = o[key];
      });
      return ordered;
    },
    oblen(o){
      return Object.keys(o).length;
    },
    antibanliker( hour, hour_liked, day, day_liked, date = new Date() ) {
      var now = dayjs();
      var liketodo = false;

      if( +hour == +now.hour() ) {
        liketodo = hour_liked < 51 ? true : false;
      } else {
        hour = now.hour();
        hour_liked = 0;
        liketodo = true;
        day_liked += +hour_liked;
      }

      if( +day == +now.date() ) {
        liketodo = day_liked < 600 ? liketodo : false;
      } else {
        day = now.date();
        day_liked = 0;
        liketodo = true;
      }

      return { hour, hour_liked, day, day_liked, liketodo };
    }
};