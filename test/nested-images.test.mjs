import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('build copies nested source images and keeps synthetic assets alongside them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'heritage-nested-'));
  try {
    cpSync('src', join(dir, 'src'), { recursive: true });
    cpSync('data/sample-img', join(dir, 'data/sample-img'), { recursive: true });
    mkdirSync(join(dir, 'data/img/volume/page'), { recursive: true });
    writeFileSync(join(dir, 'data/img/volume/page/scan.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const records = JSON.parse(readFileSync('data/records.sample.json', 'utf8'));
    records[0].imagen = 'img/volume/page/scan.svg';
    writeFileSync(join(dir, 'data/records.json'), JSON.stringify(records));
    symlinkSync(resolve('node_modules'), join(dir, 'node_modules'), 'dir');
    const run = spawnSync(process.execPath, ['src/build.mjs'], { cwd: dir, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(readFileSync(join(dir, 'site/img/volume/page/scan.svg'), 'utf8'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    assert.ok(existsSync(join(dir, 'site/img/sample-page.svg')));
    assert.ok(existsSync(join(dir, 'site/r')));
    assert.ok(!existsSync(join(dir, 'site/img/img')), 'copy contents, not an extra img directory');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


for (const mode of ['source-file', 'source-directory', 'dangling', 'sample-destination', 'root']) {
  test(`build rejects image symlinks without overwriting outside files: ${mode}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'heritage-symlink-'));
    try {
      cpSync('src', join(dir, 'src'), { recursive: true });
      cpSync('data/sample-img', join(dir, 'data/sample-img'), { recursive: true });
      mkdirSync(join(dir, 'data/img'), { recursive: true });
      writeFileSync(join(dir, 'outside.txt'), 'OUTSIDE_SENTINEL');
      mkdirSync(join(dir, 'outside-dir'));
      writeFileSync(join(dir, 'outside-dir/secret.txt'), 'DIRECTORY_SENTINEL');
      if (mode === 'sample-destination') {
        symlinkSync(join(dir, 'outside.txt'), join(dir, 'data/sample-img/collision.txt'));
        writeFileSync(join(dir, 'data/img/collision.txt'), 'REPLACEMENT');
      } else if (mode === 'root') {
        rmSync(join(dir, 'data/img'), { recursive: true });
        symlinkSync(join(dir, 'outside-dir'), join(dir, 'data/img'), 'dir');
      } else {
        const target = mode === 'source-directory' ? 'outside-dir' : mode === 'dangling' ? 'missing' : 'outside.txt';
        symlinkSync(join(dir, target), join(dir, 'data/img/leak'), mode === 'source-directory' ? 'dir' : 'file');
      }
      cpSync('data/records.sample.json', join(dir, 'data/records.json'));
      symlinkSync(resolve('node_modules'), join(dir, 'node_modules'), 'dir');
      const run = spawnSync(process.execPath, ['src/build.mjs'], { cwd: dir, encoding: 'utf8' });
      assert.notEqual(run.status, 0, run.stdout);
      assert.match(run.stderr, /Image symlinks are not allowed/);
      assert.equal(readFileSync(join(dir, 'outside.txt'), 'utf8'), 'OUTSIDE_SENTINEL');
      assert.equal(readFileSync(join(dir, 'outside-dir/secret.txt'), 'utf8'), 'DIRECTORY_SENTINEL');
      assert.ok(!existsSync(join(dir, 'site/img/leak')));
      assert.ok(!existsSync(join(dir, 'site/img/collision.txt')));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test('regular custom image collision intentionally overrides sample file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'heritage-collision-'));
  try {
    cpSync('src', join(dir, 'src'), { recursive: true });
    cpSync('data/sample-img', join(dir, 'data/sample-img'), { recursive: true });
    mkdirSync(join(dir, 'data/img'), { recursive: true });
    writeFileSync(join(dir, 'data/img/sample-page.svg'), 'CUSTOM_OVERRIDE');
    cpSync('data/records.sample.json', join(dir, 'data/records.json'));
    symlinkSync(resolve('node_modules'), join(dir, 'node_modules'), 'dir');
    const run = spawnSync(process.execPath, ['src/build.mjs'], { cwd: dir, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(readFileSync(join(dir, 'site/img/sample-page.svg'), 'utf8'), 'CUSTOM_OVERRIDE');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
