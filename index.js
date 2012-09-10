module.exports = table;

function table(table) {
  if (typeof table !== 'object') throw new Error('To use table, you must pass an element of type "<table>"');
  if (table.tagName !== 'TABLE') throw new Error('To use table, the table must be of type "<table>"');

  var exports = {};

  var templates = getTemplates(table);
  var columns = getColumns(table);

  var dataSource;
  var rowRenderer;

  var plugins = [];

  exports.use = use;
  function use(plugin) {
    if (dataSource) plugin(exports, templates, columns, dataSource);
    else plugins.push(plugin);
  }

  exports.renderer = renderer;
  function renderer(renderer) {
    if (!renderer) throw new Error('RowRenderer can\'t be null');
    if (rowRenderer) throw new Error('You can\'t set the RowRenderer multiple times');
    rowRenderer = renderer;
    render();
  }

  exports.source = source;
  function source(dSource) {
    if (!dSource) throw new Error('DataSource can\'t be null');
    if (dataSource) throw new Error('You can\'t set the DataSource multiple times');
    dataSource = dSource;
    dataSource.getID = dataSource.getID || function (record) { return record.id; };
    render();
  }
  function render() {
    if (!dataSource || !rowRenderer) return;
    for (var i = 0; i < plugins.length; i++) {
      plugins[i](exports, templates, columns, dataSource);
    }
    plugins = null; //prevent memory leak
    update(); //todo: provide a callback
  }

  var elementCache = {};
  var nextElementCache = {};
  exports.update = update;
  function update(callback) {
    var options = {};
    nextElementCache = {};
    //todo: trigger events then update ui, then trigger more events
    trigger('pre-load', [options], function (err) {
      if (err) return callback(err);
      dataSource.getRows(options, function (err, records, hasMore) {
        if (err) return callback(err);
        trigger('post-load', [options, records, hasMore], function (err) {
          if (err) return callback(err);
          var i = records.length;
          function next(err) {
            if (err) return callback(err);
            if (--i < 0) return after();

            add(records, i, next);
          }
          next();

          function after() {
            elementCache = nextElementCache;
          }
        });
      });
    });
  }

  function add(records, i, callback) {
    var record = records[i];
    var id = source.getID(record);
    if (nextElementCache[id]) return callback(new Error('The same id can\'t appear twice in the table'));
    trigger('pre-render', [record, id, records, i], function (err) {
      rowRenderer(record, id, function (err, result) {
        if (err) return callback(err);
      });
    });
  }

  var events = {};
  function trigger(name, args, callback) {
    var handlers = events[name];
    var i = 0;
    function next(err) {
      if (err) return callback(err);
      else if (++i >= handlers.length) return callback();
      handlers[i].apply(null, args.concat(next));
    }
    next();
  }
  exports.register = register;
  function register(name, handler) {
    events[name].push(handler);
  }
  return exports;
}


function getTemplates(table) {
  var result = {};
  var scripts = table
    .getElementsByTagName('tbody')[0]
    .getElementsByTagName('script');

  for (var i = 0; i < scripts.length; i++) {
    result[scripts[i].getAttribute('type').replace('application/', '')] = scripts[i].innerHTML;
  }

  table.getElementsByTagName('tbody')[0].innerHTML = '';

  return result;
}

function getColumns(table) {
  var headers = table
    .getElementsByTagName('thead')[0]
    .getElementsByTagName('tr')[0]
    .getElementsByTagName('th');
  var results = [];
  for (var i = 0; i < headers.length; i++) {
    var result = dataAttribute(headers[i]);
    result.innerHTML = headers[i].innerHTML;
    result.headerElement = headers[i];
    results.push(result);
  }
  return results;

}
function dataAttribute(element){
  return function dataAttribute(name, value) {
    name = 'data-' + name.replace(/([A-Z])/g, function (_, l) {
      return '-' + l.toLowerCase();
    });
    if (typeof value === 'undefined') {
      return element.getAttribute(name);
    } else {
      element.setAttribute(name, value);
    }
  };
}