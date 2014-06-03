(function(){
	var mysql = require('mysql');
	var root = this;
	var sqlchain = {
		sqlQ: [],
		err: "ok"
	};
	if (typeof module !== 'undefined' && module.exports) {
        module.exports = sqlchain;
    }else {
    	root.sqlchain = sqlchain;
    }

    // wrapper function always return sqlchain
    function _(func){
    	return function(){
    		func.apply(sqlchain, arguments);
    		return sqlchain;
    	}
    }

	sqlchain.pool = _(function(cf){
		if (this.pl) {this.pl = null;}
		this.cf = cf;
		this.pl = mysql.createPool(this.cf); // extends old and new config here
	});

	sqlchain.db = _(function(database){
		if (_isNull(database)) {
			this.run("SHOW DATABASES");
		}else if (_isString(database)){
			this.cf.database = database;
			this.pool(this.cf);
		}
	});

	sqlchain.table = _(function(tb){
		if (_isNull(tb)) {
			this.run("SHOW TABLES");
		}else if (_isString(tb)){
			this.tb = tb;
			this.sqlQ.length = 0;
		}
	});

	sqlchain.find = _(function(cols){
		var sql = '';
		cols = cols||'*';
		if (_isString(cols) && !_isNull(this.tb)){
			sql = 'SELECT ' + cols + ' FROM ' + this.tb;
		}else {
			// not support here
		}
		this.sqlQ.push(sql);
	});

	sqlchain.count = _(function(cols){
		var sql = '';
		cols = cols||'*';
		if (_isString(cols) && cols.indexOf(",") > -1){
			sql = 'SELECT COUNT(' + cols + ') FROM ' + this.tb;
		}else {
			// not support here
		}
		this.sqlQ.push(sql);
	});

	sqlchain.filter = _(function(){
		var sql = this.sqlQ.pop();

		this.sqlQ.push(sql);
	});

	sqlchain.group = _(function(col){
		var sql = this.sqlQ.pop();
		if (_isString(col) && sql.indexOf('SELECT')>-1 && sql.indexOf('ORDER BY')==-1){
			if (sql.indexOf('GROUP BY') == -1) {
				sql += ' GROUP BY ';
			}else {
				sql += ', '
			}
			sql += col;
		}else {
			// not support here
		}
		this.sqlQ.push(sql);
	});

	sqlchain.asc = _(function(col){
		var sql = this.sqlQ.pop();
		sql = _orderby(sql, col, true);
		this.sqlQ.push(sql);
	});

	sqlchain.desc = _(function(col){
		var sql = this.sqlQ.pop();
		sql = _orderby(sql, col, false);
		this.sqlQ.push(sql);
	});

	function _orderby(sql, col, flag){
		if (sql != null && sql.indexOf('SELECT')>-1) {
			if (sql.indexOf('ORDER BY') == -1) {
				sql += ' ORDER BY ';
			}else {
				sql += ', '
			}
			sql += col;
			sql += (flag) ? ' ASC': ' DESC';
		}
		return sql;
	}

	sqlchain.limit = _(function(num, pageSize){
		var sql = this.sqlQ.pop();
		if (sql != null && sql.indexOf('SELECT')>-1) {
			sql += ' LIMIT ' + num;
			if (pageSize){
				sql += ', ' + pageSize;
			}
		}else {
			// not select query
		}
		this.sqlQ.push(sql);
	});

	sqlchain.insert = _(function(object){
		var objArr = _isArray(object) ? object : [object] ;
		var arrVal = [];
		var arrKey = [];
		_parser(objArr, arrKey, arrVal);
		var sql = 'INSERT INTO ' + this.tb + ' (';
		for (var i = 0, len = arrKey[0].length; i<len; i++) {
			sql += arrKey[0][i] + ',';
		}
		sql = sql.replace(new RegExp(',$'), '');
		sql += ') ';
		sql += 'VALUES ';
		for (var i = 0, len = arrVal.length; i<len; i++) {
			sql += '(';
			for (var j = 0, _len = arrVal[i].length; j<_len; j++) {
				var val = arrVal[i][j];
				if (_isString(val)) {
					val = '"' + val + '"';
				}
				sql += val + ',';
			}
			sql = sql.replace(new RegExp(',$'), '');
			sql += '),';
		}
		sql = sql.replace(new RegExp(',$'), '');
		this.sqlQ.push(sql);
	});

	sqlchain.run = function(sqlOrFunc, func){
		if (_isNull(sqlOrFunc) || _isFunction(sqlOrFunc)) {
			var sqlE = this.sqlQ.pop(); // multiple sqls
			_exec(this.pl, sqlE, sqlOrFunc);
		}else if (_isString(sqlOrFunc)) {
			_exec(this.pl, sqlOrFunc, func);
		}else {
			// throw err here!!!
		}
	};

	function _exec(pl, sql, func) { 
		if (_isEmpty(sql)){
			throw new Error("sql is not ready!");
		}
		console.log("[sql]: ", sql);
		pl.getConnection(function(err, connection){
			if ( sql.indexOf('USE') > -1 ) {
				connection.changeUser(
					{database: sql.replace(new RegExp('^USE '), '')}, 
				function(err){
					if (err) throw err;
					connection.release();
				});
			}else {
				connection.query(sql, function(err, rows){
					if (err) {throw err;}
					connection.release();
					if (_isFunction(func)){
						func(err, rows);
					}
				});
			}
		});
	}

	function _parser( obj, arrKey, arrVal ) {
		if ( _isArray(obj) ) {
			var len = obj.length;
			var i = 0;
			while (i<len){
				var _arrKey = [];
				var _arrVal = [];
				arguments.callee.apply(this, [obj[i++], _arrKey, _arrVal]);
				arrKey.push(_arrKey);
				arrVal.push(_arrVal);
			}
		}else if ( _isObject(obj) ) {
			for (var key in obj) {
			  	if ( obj.hasOwnProperty(key) ) {
			  		var _obj = obj[key];
			  		//console.log(key, "->", _obj);
			  		if ( _obj == null) continue;
			  		if ( _isObject(_obj) ) {
			  			arguments.callee.apply(this, [_obj, arrKey, arrVal]);
			  		}else if ( _isArray(_obj) ) {
			  			// array not handle here
			  		}else if ( _isString(_obj) || _isNumber(_obj) ) {
			  			arrKey.push(key);
			  			arrVal.push(_obj);
			  		}
			  	}
			}
		}
	}

	function _isNull(){
		return (arguments[0] == null || arguments[0] == 'undefined');
	}
	function _isEmpty() {
		return (_isNull(arguments[0]) || !arguments[0].length);
	}
	function _isFunction() {
		return (typeof arguments[0] === 'function');
	}
	function _isString() {
		return (typeof arguments[0] === 'string');
	}
	function _isObject() {
		return (arguments[0].constructor === Object && !arguments[0].hasOwnProperty('length'));
	}
	function _isArray() {
		return (arguments[0].constructor === Array);
	}
	function _isNumber() {
		return (!isNaN(parseFloat(arguments[0])));
	}
})();