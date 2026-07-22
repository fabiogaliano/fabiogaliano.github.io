#!/usr/bin/env bun
// Builds fabio-galiano-cv.pdf from index.html so the PDF is reproducible from
// source. Browsers (⌘P → Save as PDF) produce the right content but cannot set
// the PDF /Author field, which ATS read for the candidate-name field — so we
// render with headless Chrome (honouring the print CSS: A4 @page + exact
// colours) and then stamp metadata with exiftool.
import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HTML = `${ROOT}index.html`;
const OUT = `${ROOT}fabio-galiano-cv.pdf`;

const AUTHOR = 'Fábio Galiano';
const TITLE = 'Fábio Galiano — Fullstack Product Engineer';

async function findChrome(): Promise<string | null> {
	const apps = [
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/Applications/Chromium.app/Contents/MacOS/Chromium',
		'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
	];
	const found = apps.find(existsSync);
	if (found) return found;
	for (const bin of ['google-chrome', 'chromium', 'chromium-browser', 'brave']) {
		const r = await $`command -v ${bin}`.nothrow().quiet();
		if (r.exitCode === 0) return r.stdout.toString().trim();
	}
	return null;
}

const chrome = await findChrome();
if (!chrome) {
	console.error('No Chrome/Chromium/Brave found — cannot render the PDF.');
	process.exit(1);
}

// --export-tagged-pdf emits a logical structure tree (lists, headings) so
// structure-aware ATS and screen readers get real list items, not just
// position-based text. Raw-text parsers ignore it, but it costs nothing and is
// the standards-correct way to convey "this is one bullet" without altering copy.
await $`${chrome} --headless=new --disable-gpu --no-pdf-header-footer --export-tagged-pdf --print-to-pdf=${OUT} ${'file://' + HTML}`.quiet();

const hasExif = (await $`command -v exiftool`.nothrow().quiet()).exitCode === 0;
if (hasExif) {
	await $`exiftool -overwrite_original -Author=${AUTHOR} -XMP-dc:creator=${AUTHOR} -Title=${TITLE} ${OUT}`.quiet();
} else {
	console.warn('exiftool not found — PDF built without /Author metadata (brew install exiftool).');
}

console.log(`Built ${OUT}`);
