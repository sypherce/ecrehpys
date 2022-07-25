/* eslint-disable */
module.exports = {
	'env': {
		'commonjs': true,
		'es2021': true,
		'node': true
	},
	'extends': 'eslint:recommended',
	'parserOptions': {
		'ecmaVersion': 'latest',
        'sourceType': 'module'
	},
	'rules': {
        'no-var': ['error'],
		'no-unused-vars': [
		  'error',
		  {
			 'varsIgnorePattern': '^_',
			 'argsIgnorePattern': '^_'
		  }
		],
		'eqeqeq': [
			'error',
			'always'
		],
		'indent': [
			'error',
			'tab'
		],
		'linebreak-style': [
			'error',
			'unix'
		],
		'quotes': [
			'error',
			'single'
		],
		'semi': [
			'error',
			'always'
		]
	}
};
