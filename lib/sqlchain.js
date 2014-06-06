(function(){
	var mysql = require('mysql');
	var root = this;
	var sqlchain = {
		sqlQ: [],
		primary: 'id',
		autocommit: true,
	};

	module.exports = sqlchain;

    // wrapper function always return sqlchain
    function _(func){
    	return function(){
    		func.apply(sqlchain, arguments);
    		return sqlchain;
    	}
    }

	sqlchain.pool = _(function(cf){
		var that = this;
		if (that.pl) {that.pl = null;}
		that.cf = cf;
		that.pl = mysql.createPool(that.cf); // extends old and new config here
		that.pl.getConnection(function(err, connection){
			if (err) {throw err;}
			that.conn = connection; // cache the connection, use array later
		});
	});


	sqlchain.db = _(function(dbOrFunc){
		var that = this;
		if (_isNull(dbOrFunc) || _isFunction(dbOrFunc)) {
			that.run("SHOW DATABASES", dbOrFunc);
		}else if (_isString(dbOrFunc)){
			that.cf.database = dbOrFunc;
			that.conn = mysql.createConnection(that.cf);
			that.conn.connect(function(err) {
		  		if (err) {
		    		console.error('error connecting: ' + err.stack);
		    		return;
		  		}
		  		console.log('connected as id ' + that.conn.threadId);
			});
			//this.pool(this.cf);
		}
	});

	// begin transaction here
	sqlchain.begin = function(func){
		var that = this;
		if (that.autocommit){
			that.autocommit = false;
			if (that.conn) {
				that.conn.query('SET AUTOCOMMIT=0', function(err){
					if (err) throw err;
					that.conn.query('BEGIN', function(err){
						if (err) throw err;
						if (_isFunction(func)) {
							func.apply(that);
						}
					});
				});
			}else {
				throw new Error('no connection found!');
			}
		}else {
			throw new Error('already disable auto-commit!');
		}
	};
	// commit transaction here
	sqlchain.commit = function(func){
		var that = this;
		if (that.autocommit){
			throw new Error('already enable auto-commit!');
		}else{
			that.autocommit = true;
			if (that.conn) {
				that.conn.query('COMMIT', function(err){
					if (err) throw err;
					that.conn.query('SET AUTOCOMMIT=1', function(err){
						if (err) throw err;
						(that.conn.release||that.conn.destroy).call(that.conn);
						if (_isFunction(func)) {
							func.apply(that);
						}
					});
				});				
			}else {
				throw new Error('no connection found!');
			}
		}
	};
	// rollback transaction here
	sqlchain.rollback = function(func){
		var that = this;
		if (!that.autocommit){
			that.autocommit = true;
			if (that.conn) {
				that.conn.query('ROLLBACK', function(err){
					if (err) throw err;
					that.conn.query('SET AUTOCOMMIT=1', function(err){
						if (err) throw err;
						(that.conn.release||that.conn.destroy).call(that.conn);
						if (_isFunction(func)) {
							func.apply(that);
						}
					});
				});
			}else {
				throw new Error('no connection found!');
			}
		}
	};

	sqlchain.table = _(function(tbOrFunc){
		if (_isNull(tbOrFunc) || _isFunction(tbOrFunc)) {
			this.run("SHOW TABLES", tbOrFunc);
		}else if (_isString(tbOrFunc)){
			this.tb = tbOrFunc;
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
		if (_isNull(sql) && this.tb){
			sql = 'SELECT * FROM ' + this.tb;
		}

		if (sql.indexOf(' WHERE ') > -1) {
			sql += ' OR ';
		}else {
			sql += ' WHERE ';
		}
		if (_isString(arguments[0])) {
			sql += arguments[0];
		}else {
			for (var i=0, len = arguments.length; i<len; i++) {
				sql += _filter(arguments[i]) + " OR ";
			}
			sql = sql.replace(new RegExp(' OR $'), '');
		}
		this.sqlQ.push(sql);
	});

	sqlchain.append = _(function(append){
		var sql = this.sqlQ.pop();
		sql += ' ' + append;
		this.sqlQ.push(sql);
	});

	function _op(key) {
		var opArr = ["eq", "ne", "lt", "gt", "lte", "gte", "in", "ni", "like"];
		var op = opArr[0];
		var idx = key.indexOf("$");
		if (idx > -1) {
			op = key.substring(idx+1);
		}
		var j=0;
		for (; j<opArr.length; j++){
			if (op === opArr[j]){
				break;
			}
		}
		switch (j) {
			case 0: op = " = "; break;
			case 1: op = " != "; break;
			case 2: op = " < "; break;
			case 3: op = " > "; break;
			case 4: op = " <= "; break;
			case 5: op = " >= "; break;
			case 6: op = " IN "; break;
			case 7: op = " NOT IN "; break;
			case 8: op = " LIKE "; break;
			default: break;
		}
		return op
	}

	function _filter(object){
		var arrVal = [];
		var arrKey = [];
		_parser(object, arrKey, arrVal);
		var sql = "(";
		for (var i=0, len = arrKey.length; i<len; i++) {
			var key = arrKey[i];
			var val = arrVal[i];
			var op = _op(key);
			var idx = key.indexOf("$");
			if (idx > -1) {
				key = key.substring(0, idx-1);
			}
			if ( _isArray(val) ) {
				if (_isObject(val[0])){
					sql += "(";
					for (var s=0; s<val.length; s++) {
						var _arrVal = [];
						var _arrKey = [];
						_parser(val[s], _arrKey, _arrVal);
						sql += key + _op(_arrKey[0]) + _arrVal[0];
						sql += " OR ";
					}
					sql = sql.replace(new RegExp(' OR $'), '');
					sql += ")";
				}else if ( _isNumber(val[0]) ){
					sql += key + op + "(" + val.join(", ") + ")";
				}else if ( _isString(arrVal[i][0]) ) {
					sql += key + op + "('" + val.join("','") + "')";
				}
			}else if ( _isNumber(val) ) {
				sql += key + op + val;
			}else if ( _isString(val) ) {
				sql += key + op + "'" + val + "'";
			}
			sql += " AND ";
		}
		sql = sql.replace(new RegExp(' AND $'), '');
		sql += ")";
		return sql;
	}

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

	sqlchain.sort = _(function(col, flag){
		var sql = this.sqlQ.pop();
		if (_isNull(sql) || sql.indexOf('SELECT') == -1){
			sql = 'SELECT * FROM ' + this.tb;
		}
		sql = _orderby(sql, col, flag);
		this.sqlQ.push(sql);
	});

	sqlchain.asc = function(col){
		return sqlchain.sort(col, true);
	};

	sqlchain.desc = function(col){
		return sqlchain.sort(col, false);
	};

	function _orderby(sql, col, flag){
		if (sql.indexOf('ORDER BY') == -1) {
			sql += ' ORDER BY ';
		}else {
			sql += ', '
		}
		sql += (col) ? col : sqlchain.primary;
		sql += (flag) ? ' ASC': ' DESC';
		return sql;
	}

	sqlchain.limit = _(function(num, pageSize){
		var sql = this.sqlQ.pop();
		if (!_isnull(sql) && sql.indexOf('SELECT')>-1) {
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

	sqlchain.update = _(function(object){
		var arrVal = [];
		var arrKey = [];
		_parser(object, arrKey, arrVal);
		var sql = 'UPDATE ' + this.tb + ' SET ';
		for (var i = 0, len = arrKey.length; i<len; i++) {
			sql += arrKey[i] + ' = ';
			var val = arrVal[i];
			if (_isString(val)) {
				val = '"' + val + '"';
			}
			sql += val + ',';
		}
		sql = sql.replace(new RegExp(',$'), '');
		this.sqlQ.push(sql);
	});

	sqlchain.remove = _(function(object){
		var sql = 'DELETE FROM ' + this.tb;
		this.sqlQ.push(sql);
		this.filter(object);
	});

	sqlchain.print = function(){
		var sql = this.sqlQ.pop();
		this.sqlQ.push(sql);
		console.log("[sql] ", sql);
	}

	sqlchain.run = function(sqlOrFunc, func){
		if (_isNull(sqlOrFunc) || _isFunction(sqlOrFunc)) {
			var sqlE = this.sqlQ.pop(); // multiple sqls
			if (_isEmpty(sqlE) && this.tb) {
				sqlE = 'SELECT * FROM ' + this.tb;
			}
			_exec(this.conn, sqlE, sqlOrFunc);
		}else if (_isString(sqlOrFunc)) {
			_exec(this.pl, sqlOrFunc, func);
		}else {
			// throw err here!!!
			throw new Error('not support yet!');
		}
	};

	function _exec(conn, sql, func){
		if (_isEmpty(sql)){
			throw new Error("sql is not ready!");
		}
		console.log("[sql] ", sql);
		conn.query(sql, function(err, rows){
			if (err) {
				sqlchain.rollback();
				throw err;
			}
			if (sqlchain.autocommit) {
				(conn.release||conn.destroy).call(conn);
			}
			if (_isFunction(func)){
				func.apply(sqlchain, [err, rows]);
			}
		});
	}

	function _parser( obj, arrKey, arrVal, prefix ) {
		if ( _isArray(obj) ) {
			var len = obj.length;
			var i = 0;
			while (i<len){
				var _arrKey = [];
				var _arrVal = [];
				arguments.callee.apply(this, [obj[i++], _arrKey, _arrVal, prefix]);
				arrKey.push(_arrKey);
				arrVal.push(_arrVal);
			}
		}else if ( _isObject(obj) ) {
			for (var key in obj) {
				var _key = (_isEmpty(prefix)) ? key : prefix + '_' + key;
			  	if ( obj.hasOwnProperty(key) ) {
			  		var _obj = obj[key];
			  		if ( _isNull(_obj) ) continue;
			  		if ( _isObject(_obj) ) {
			  			arguments.callee.apply(this, [_obj, arrKey, arrVal, _key]);
			  		}else if ( _isArray(_obj) ) {
			  			// array not handle here
			  			arrKey.push(_key);
			  			arrVal.push(_obj);
			  		}else if ( _isString(_obj) || _isNumber(_obj) ) {
			  			arrKey.push(_key);
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