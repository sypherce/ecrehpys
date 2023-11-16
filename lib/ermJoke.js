'use strict';
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const erm = require('node-ermahgerd');
const ja = require('../node_modules/json-append/lib/json-append.js')

async function getJoke() {
	try {
		const response = await fetch(
			`https://api.api-ninjas.com/v1/jokes`,
			{
				method: 'GET',
				headers: {
					'X-Api-Key': process.env.X_API_KEY,
					//accept: 'application/json',
				},
			}
		);
		if(!response.ok)
			throw new Error(`HTTP error! status: ${response.status}`);

		//store joke into file for later
		const joke = (await response.json())[0].joke;
		console.log(joke);
		ja.append(joke, 'jokes.json');
		return joke;

	} catch(err) {
		console.log(err);
		return '';
	}
}

/**
 * Retrives a joke and translates it to ermahgerd
 * @return {string}
 */
async function ermJoke() {
	const joke = await getJoke();

	return erm.translate(joke);
}

module.exports.get = ermJoke;