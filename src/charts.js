/*!
 * (c) 2012-2014 Paul Vorbach.
 *
 * MIT License (http://vorba.ch/license/mit.html)
 */

// Object.keys polyfill
// from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
if (!Object.keys) {
  Object.keys = (function () {
    'use strict';
    var hasOwnProperty = Object.prototype.hasOwnProperty,
        hasDontEnumBug = !({toString: null}).propertyIsEnumerable('toString'),
        dontEnums = [
          'toString',
          'toLocaleString',
          'valueOf',
          'hasOwnProperty',
          'isPrototypeOf',
          'propertyIsEnumerable',
          'constructor'
        ],
        dontEnumsLength = dontEnums.length;

    return function (obj) {
      if (typeof obj !== 'object' && (typeof obj !== 'function' || obj === null)) {
        throw new TypeError('Object.keys called on non-object');
      }

      var result = [], prop, i;

      for (prop in obj) {
        if (hasOwnProperty.call(obj, prop)) {
          result.push(prop);
        }
      }

      if (hasDontEnumBug) {
        for (i = 0; i < dontEnumsLength; i++) {
          if (hasOwnProperty.call(obj, dontEnums[i])) {
            result.push(dontEnums[i]);
          }
        }
      }
      return result;
    };
  }());
}

function getURLParam(name) {
  var match = new RegExp(name + '=' + '(.*?)(&|$)')
      .exec(location.search);
  if (match === null)
    return null;

  return match[1];
}

function chart(id, type, title, data, xAxisType, xAxisTitle, cats, trend) {
  return new Highcharts.Chart({
    chart: {
      renderTo: id,
      zoomType: 'x',
      type: type
    },
    title: {
      text: title,
      style: {
        color: '#000000'
      }
    },
    subtitle: {
      text: typeof document.ontouchstart == 'undefined' ?
        'Click and drag in the plot to zoom in' :
        'Drag your finger over the plot to zoom in',
      style: {
        color: '#000000'
      }
    },
    exporting: {
      enableImages: true
    },
    credits: {
      enabled: false
    },
    xAxis: (xAxisType == 'datetime' ? {
      type: xAxisType,
      maxZoom: 14 * 24 * 60 * 60 * 1000,
      lineColor: '#000000',
      title: {
        text: xAxisTitle,
        style: {
          color: '#000000'
        }
      }
    } : {
      type: xAxisType,
      lineColor: '#000000',
      categories: cats,
      title: {
        text: xAxisTitle,
        style: {
          color: '#000000'
        }
      }
    }),
    yAxis: {
      min: 0,
      startOnTick: false,
      showFirstLabel: false,
      title: {
        text: 'Downloads',
        style: {
          color: '#000000'
        }
      }
    },
    tooltip: {
      shared: true
    },
    legend: {
      enabled: false
    },
    plotOptions: {
      column: {
        borderWidth: 0,
        color: '#AA0000',
        pointPadding: 0,
        shadow: false
      },
      line: {
        color: '#006666',
        lineWidth: 1,
        marker: {
          radius: 2
        }
      }
    },
    series: trend ?
      [{name: 'Downloads', data: data},
       {name: (xAxisTitle == 'Day' ? '30 Day' : '10 Week') + ' Avg', data: trend, type: 'line'}]
      :[{name: 'Downloads', data: data}]
  });
}

function totalDownloads(data) {
  var result = 0;
  for (var i in data) {
    result += data[i].downloads;
  }
  return result.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function calculate(data) {
  var juttle = new EmbeddedJuttle(
    'reduce val=sum(downloads) by day | sort day | put time = Date.new(day) ' +
    '| ( reduce -every :day: val=sum(val) | put t=Date.unixms(time - :1d:) ' +
    '      | put -over :28 days: avg=Math.floor(avg(val)) | view daily;' +
    '    reduce -every :week: -on :1970-01-05: val=sum(val) | put t=Date.unixms(time - :1w:) ' +
    '      | put -over :12 weeks: avg=Math.floor(avg(val)) | view weekly;' +
    '    reduce -every :month: val=sum(val) | put t=Date.format(time - :1M:, "MMM YYYY") | view monthly;' +
    '    reduce -every :year: val=sum(val) | put t=Date.format(time - :1y:, "YYYY") | view yearly )'
  );

  return juttle.run({wait: true, points: data})
  .then(function(result) {
    var data = {};
    var views = Object.keys(result.output);
    for (var i in views) {
      var view = result.output[views[i]].type;
      var points = result.output[views[i]].data;
      data[view] = {values: [], cats: [], trend: []};
      for (var j in points) {
        if (view === 'daily' || view === 'weekly') {
          data[view].values.push([points[j].point.t, points[j].point.val]);
          data[view].trend.push([points[j].point.t, points[j].point.avg]);
        } else {
          data[view].values.push(points[j].point.val);
          data[view].cats.push(points[j].point.t);
        }
      }
    }
    return data;
  });
}

function getPackageList(json) {
  var result = [];
  var len = json.rows.length;
  for (var i = 0; i < len; i++) {
    result.push(json.rows[i].key[1]);
  }
  return result;
}

function getData(url, callback) {
  $.ajax({
    url: url,
    dataType: 'json',
    success: callback,
    error: function () {
      console.log('Could not receive statistical data.');
      $('#loading').html('An error occured. Please try to reload the page or '
        + 'contact me at <a href="mailto:paul@vorba.ch">paul@vorba.ch</a> if '
        + 'that doesn\'t help.');
    }
  });
}

function numPad(x) {
  return x < 10 ? '0'+x : x;
}

function dateToString(date) {
  return date.getFullYear() + '-' + numPad(date.getMonth() + 1) + '-'
    + numPad(date.getDate());
}

function dateToHumanString(date) {
  return date.toDateString().substring(4);
}

function downloadsURL(pkg, from, to) {
  return 'https://api.npmjs.org/downloads/range/' + dateToString(from) + ':' + dateToString(to) + '/'
    + pkg;
}

function drawCharts(data, showTrend) {
  calculate(data)
  .then(function(result) {
    $('#content figure').css('min-width', result.daily.values.length * 2 + 67);
    chart('days', 'column', 'Downloads per day', result.daily.values,
      'datetime', 'Day', undefined, showTrend && result.daily.trend);
    chart('weeks', 'column', 'Downloads per week', result.weekly.values,
      'datetime', 'Week', undefined, showTrend && result.weekly.trend);
    chart('months', 'column', 'Downloads per month', result.monthly.values,
      'linear', 'Month', result.monthly.cats, undefined, result.monthly.trend);
    chart('years', 'column', 'Downloads per year', result.yearly.values,
      'linear', 'Year', result.yearly.cats);
  });
}

function showPackageStats(pkg, from, to, showTrend) {
  $('h2').append(' for package "' + pkg + '"');
  $('#npm-stat input[name="package"]').attr('value', pkg);
  $('#npm-stat').after('<p id="loading"></p><p><a '
    + 'href="https://npmjs.org/package/'
    + pkg + '">View package on npm</a></p>');

  $('#loading').html('<img src="loading.gif" />');

  var url = downloadsURL(pkg, from, to);

  getData(url, function (json) {
    var data = json.downloads;
    $('h2').after('<p>Total number of downloads between <em>'
      + dateToHumanString(from) + '</em> and <em>'
      + dateToHumanString(to) + '</em>: <strong>'
      + totalDownloads(data) + '</strong></p>');

    $('#loading').remove();

    drawCharts(data, showTrend);
  });
}

function showAuthorStats(author, from, to, showTrend) {
  $('h2').html('Downloads for author "' + author + '"');
  $('#npm-stat input[name="author"]').attr('value', author);
  $('#npm-stat').after('<p id="loading"></p><p><a '
    + 'href="https://npmjs.org/~'
    + author + '">View author on npm</a></p>');

  $('#loading').html('<img src="loading.gif" />');

  var url = '/-/_view/browseAuthors?'
    +'group_level=3&start_key=["'+author+'"]&end_key=["'+author+'",{}]';

  getData(url, function (json) {
    var pkgs = getPackageList(json);
    var len = pkgs.length;
    var todo = len;

    var allDownloads = [];
    var totals = [];
    for (var i = 0; i < len; i++) {(function (pkg) {
      var url = downloadsURL(pkg, from, to);
      getData(url, function (json) {
        allDownloads = allDownloads.concat(json.downloads);

        var total = totalDownloads(json.downloads);
        totals.push({name: pkg, count: total});

        if (!--todo) {
          $('h2').after('<p>All downloads of packages by author <em>'
            + author + '</em> between <em>'
            + dateToHumanString(from) + '</em> and <em>'
            + dateToHumanString(to) + '</em>: <strong>'
            + totalDownloads(allDownloads) + '</strong></p>');

          $('#loading').remove();

          totals = totals.sort(function(a,b) {
            return b.count.replace(/,/g, '') - a.count.replace(/,/g, '');
          });

          $('#pkgs').append('<h3>Packages by '+author+'</h3><ul></ul>');
          for (var i = 0; i < totals.length; i++) {
            var t = totals[i];
            $('#pkgs ul').append('<li><a href="charts.html?package='
              + t.name + '" title="view detailed download statistics">'
              + t.name + '</a>, total downloads: '+t.count+'</li>');
          }

          drawCharts(allDownloads);
        }
      });
      })(pkgs[i]);
    }
  });
}

$(function() {
  var from, to;
  var fromParam = getURLParam('from');
  var toParam = getURLParam('to');
  var showTrend = !!getURLParam('trend');

  if (toParam === null || fromParam === '') {
    to = new Date();
  } else {
    try {
      to = new Date(toParam);
    } catch (e) {
      return alert('Invalid date format in URL parameter "to"');
    }
  }
  $('input[name="to"]').attr('value', dateToString(to));

  if (fromParam === null || fromParam === '') {
    from = new Date(to.getTime() - (1000*60*60*24*365*2));
  } else {
    try {
      from = new Date(fromParam);
    } catch (e) {
      return alert('Invalid date format in URL parameter "from"');
    }
  }
  $('input[name="from"]').attr('value', dateToString(from));

  $('input[name="trend"]').attr('checked', showTrend);

  var pkg;

  var author = getURLParam('author');
  if (!author) {
    pkg = getURLParam('package');

    if (!pkg) {
      pkg = 'clone';
    }

    $('title').html('npm-stat: ' + pkg);
    showPackageStats(pkg, from, to, showTrend);
  } else {
    $('title').html('npm-stat: ' + author);
    showAuthorStats(author, from, to, showTrend);
  }
});
