#!/usr/bin/env node

import { exec } from 'child_process';
import { existsSync, promises as fs } from 'fs';
import { extname, resolve, basename } from 'path';

import { load } from 'cheerio';
import { Command } from 'commander';

const { rm, readdir, readFile, writeFile } = fs;

const cli = new Command();

const SVG_PROPS = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true"';
const SVG_STYLE = 'style="width: 0; height: 0; visibility: hidden; position: absolute;"';

cli.option('-i, --input [input]', 'Specifies input dir (current dir by default)', '.')
	.option('-o, --output [output]', 'Specifies output file ("./sprite.svg" by default)', 'sprite.svg')
	.option('-v, --viewbox [viewbox]', 'Specifies viewBox attribute (parsed by default)', '')
	.option('-p, --prefix [prefix]', 'Specifies prefix for id attribute (none by default)', 'icon-')
	.option('-c, --config [config]', 'Absolute path to the config file for SVGO-ViewBox.', './config/svgo.config.js')
	.parse(process.argv);

const { input: INPUT, output: OUTPUT, viewbox: VIEWBOX, prefix: PREFIX, quiet: QUIET, config: CONFIG } = cli.opts();

const onEnd = (): void => console.log(`File ‘${OUTPUT}’ successfully generated.`);
const getSvg = (content: string) => load(content)('svg').first();
const filterFile = (file: string) => extname(file) === '.svg';
const processFiles = (files: string[]) => Promise.all(files.filter(filterFile).map(processFile));
const removeOutput = async () => (existsSync(OUTPUT) ? await rm(OUTPUT) : undefined);
const getSvgContent = (content: string) => getSvg(content).html();
const readSrcFolder = () => readdir(INPUT);
const writeDestFile = (content: string) => writeFile(OUTPUT, content, 'utf8');
const getSpriteContent = (contents: string[]) => `<svg ${SVG_PROPS} ${SVG_STYLE}>${contents.join('')}</svg>`;
// prettier-ignore
const getSymbol = (content: string, attrs: Record<string, unknown>) => `<symbol ${getAttributes(attrs)}>${getSvgContent(content)}</symbol>`;

const getAttributes = (attrs: Record<string, unknown>) =>
	Object.keys(attrs).reduce((acc, key) => {
		const value = attrs[key];

		return value ? `${acc} ${key}='${value}'` : acc;
	}, '');

const wrapFile = (fileName: string, content: string) => {
	const attrs = {
		id: (PREFIX + fileName).replace(/\s/g, '-'),
		viewBox: VIEWBOX || getSvg(content).attr('viewbox'),
		preserveAspectRatio: getSvg(content).attr('preserveaspectratio')
	};

	return getSymbol(content, attrs);
};

const processFile = (file: string) => {
	const path = resolve(INPUT, file);
	const name = basename(file, extname(file));
	const wrapContent = wrapFile.bind(null, name);

	return readFile(path, 'utf8').then(wrapContent);
};

const onError = (err: Error) => {
	throw err;
};

removeOutput()
	.then(readSrcFolder)
	.then((files: string[]) => {
		exec(`svgo-viewbox -i ${INPUT} -f ${CONFIG}`);

		return processFiles(files);
	})
	.then(getSpriteContent)
	.then(writeDestFile)
	.then(onEnd)
	.catch(onError);
