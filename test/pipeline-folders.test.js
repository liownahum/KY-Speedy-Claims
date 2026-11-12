'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const clone = value => JSON.parse(JSON.stringify(value));

function environment() {
  const properties = new Map();
  const folders = new Map();
  const metadata = new Map();
  const calls = [];
  const env = { failMove: false, loseMoveAcknowledgement: false };
  let next = 1;
  function folder(id, parent = null) {
    const value = {
      parent, trashed: false, getId: () => id,
      isTrashed() { return this.trashed; },
      getParents() {
        const result = this.parent ? [this.parent] : [];
        return { hasNext: () => result.length > 0, next: () => result.shift() };
      },
      createFolder(name) {
        calls.push(['create', id, name]);
        return folder('generated-' + next++, this);
      },
      moveTo(destination) {
        calls.push(['move', id, destination.getId()]);
        if (env.failMove) throw new Error('Move permission denied');
        for (let ancestor = destination; ancestor; ancestor = ancestor.parent) {
          if (ancestor === this) throw new Error('Cannot move into a descendant folder');
        }
        this.parent = destination;
        if (env.loseMoveAcknowledgement) {
          env.loseMoveAcknowledgement = false;
          throw new Error('Move acknowledgement lost');
        }
        return this;
      }
    };
    folders.set(id, value);
    metadata.set(id, { id, mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true } });
    return value;
  }
  const myDrive = folder('my-drive');
  const event = folder('event-folder', myDrive);
  const config = { eventId: 'event-unique-id', eventCode: 'TEST', eventTitle: 'Test Event', questions: {}, active: false };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties.get(key) ?? null,
      setProperty: (key, value) => properties.set(key, value)
    }) },
    DriveApp: {
      createFolder: name => myDrive.createFolder(name),
      getFolderById(id) {
        if (!folders.has(id)) throw new Error('Folder not found or inaccessible');
        return folders.get(id);
      }
    },
    Drive: { Files: { get(id, options) {
      calls.push(['metadata', id]);
      assert.equal(options.supportsAllDrives, true);
      assert.match(options.fields, /canAddChildren/);
      if (!metadata.has(id)) throw new Error('File not found or inaccessible');
      return clone(metadata.get(id));
    } } }
  });
  vm.runInContext(fs.readFileSync('src/ClaimPipeline.gs', 'utf8'), context);
  return Object.assign(env, { context, config, properties, folders, metadata, calls, folder, myDrive, event });
}

test('a selected event folder contains the new claims folder and reruns reuse it', () => {
  const env = environment();
  env.properties.set('PIPELINE_PARENT_FOLDER_ID', 'event-folder');
  const root = env.context.claimRootFolder_(env.config);
  assert.equal(root.parent, env.event);
  assert.equal(env.config.rootFolderId, root.getId());
  assert.equal(env.config.parentFolderId, 'event-folder');
  assert.equal(env.context.claimRootFolder_(env.config), root);
  assert.equal(env.calls.filter(call => call[0] === 'create').length, 1);
  assert.equal(env.calls.filter(call => call[0] === 'move').length, 0);
});

test('normal folder links and account-specific links resolve to the selected folder', () => {
  for (const value of [
    ' https://drive.google.com/drive/folders/event-folder?usp=sharing ',
    'https://drive.google.com/drive/u/1/folders/event-folder/',
    'https://drive.google.com/drive/folders/event-folder#test'
  ]) {
    const env = environment();
    env.properties.set('PIPELINE_PARENT_FOLDER_ID', value);
    assert.equal(env.context.claimRootFolder_(env.config).parent, env.event);
    assert.equal(env.config.parentFolderId, 'event-folder');
  }
});

test('an unset or blank destination preserves the original My Drive default for a new event', () => {
  for (const value of [null, '', '   ']) {
    const env = environment();
    if (value !== null) env.properties.set('PIPELINE_PARENT_FOLDER_ID', value);
    assert.equal(env.context.claimRootFolder_(env.config).parent, env.myDrive);
    assert.equal(env.config.parentFolderId, null);
    assert.equal(env.calls.filter(call => call[0] === 'metadata').length, 0);
  }
});

test('changing the destination relocates the whole existing claims tree without changing its IDs', () => {
  const env = environment();
  const root = env.context.claimRootFolder_(env.config);
  const person = env.folder('person-folder', root);
  const receipts = env.folder('receipts-folder', person);
  env.config.active = true;
  env.config.formId = 'form-id'; env.config.registerId = 'register-id'; env.config.nativeTemplateId = 'template-id';
  env.config.uploadQuestionId = 77; env.config.questions.fullName = 42;
  const before = clone(env.config);
  env.properties.set('PIPELINE_PARENT_FOLDER_ID', 'event-folder');

  assert.equal(env.context.claimRootFolder_(env.config), root);
  assert.equal(root.parent, env.event);
  assert.equal(person.parent, root);
  assert.equal(receipts.parent, person);
  assert.deepEqual(env.config, { ...before, parentFolderId: 'event-folder' });
  assert.equal(env.calls.filter(call => call[0] === 'create').length, 1);
  assert.equal(env.calls.filter(call => call[0] === 'move').length, 1);
  env.context.claimRootFolder_(env.config);
  assert.equal(env.calls.filter(call => call[0] === 'move').length, 1);
});

test('clearing the property leaves an existing claims folder in its current location', () => {
  const env = environment();
  env.properties.set('PIPELINE_PARENT_FOLDER_ID', 'event-folder');
  const root = env.context.claimRootFolder_(env.config);
  env.properties.delete('PIPELINE_PARENT_FOLDER_ID');
  assert.equal(env.context.claimRootFolder_(env.config), root);
  assert.equal(root.parent, env.event);
  assert.equal(env.config.parentFolderId, 'event-folder');
  assert.equal(env.calls.filter(call => call[0] === 'move').length, 0);
});

test('invalid, inaccessible, non-folder, read-only, trashed and Shared Drive targets fail before creation', () => {
  const scenarios = [
    env => env.properties.set('PIPELINE_PARENT_FOLDER_ID', 'https://example.com/drive/folders/event-folder'),
    env => env.properties.set('PIPELINE_PARENT_FOLDER_ID', 'inaccessible'),
    env => { env.metadata.get('event-folder').mimeType = 'application/vnd.google-apps.document'; },
    env => { env.metadata.get('event-folder').capabilities.canAddChildren = false; },
    env => { env.event.trashed = true; },
    env => { env.metadata.get('event-folder').driveId = 'shared-drive-id'; }
  ];
  for (const configure of scenarios) {
    const env = environment();
    env.properties.set('PIPELINE_PARENT_FOLDER_ID', 'event-folder');
    configure(env);
    assert.throws(() => env.context.claimRootFolder_(env.config));
    assert.equal(env.calls.filter(call => call[0] === 'create' || call[0] === 'move').length, 0);
    assert.equal(env.config.rootFolderId, undefined);
  }
});

test('a failed relocation preserves the previous saved location and retries the same root folder', () => {
  const env = environment();
  const root = env.context.claimRootFolder_(env.config);
  const before = clone(env.config);
  env.properties.set('PIPELINE_PARENT_FOLDER_ID', 'event-folder');
  env.failMove = true;
  assert.throws(() => env.context.claimRootFolder_(env.config), /Move permission denied/);
  assert.equal(root.parent, env.myDrive);
  assert.deepEqual(env.config, before);
  env.failMove = false;
  assert.equal(env.context.claimRootFolder_(env.config), root);
  assert.equal(root.parent, env.event);
  assert.equal(env.calls.filter(call => call[0] === 'create').length, 1);
});

test('a lost move acknowledgement is recovered without another move or a replacement folder', () => {
  const env = environment();
  const root = env.context.claimRootFolder_(env.config);
  env.properties.set('PIPELINE_PARENT_FOLDER_ID', 'event-folder');
  env.loseMoveAcknowledgement = true;
  assert.throws(() => env.context.claimRootFolder_(env.config), /acknowledgement lost/);
  assert.equal(root.parent, env.event);
  assert.equal(env.config.parentFolderId, null);
  assert.equal(env.context.claimRootFolder_(env.config), root);
  assert.equal(env.config.parentFolderId, 'event-folder');
  assert.equal(env.calls.filter(call => call[0] === 'move').length, 1);
});

test('the claims folder itself or one of its descendants cannot become its destination', () => {
  const env = environment();
  const root = env.context.claimRootFolder_(env.config);
  const child = env.folder('child-folder', root);
  for (const target of [root, child]) {
    env.properties.set('PIPELINE_PARENT_FOLDER_ID', target.getId());
    assert.throws(() => env.context.claimRootFolder_(env.config));
    assert.equal(root.parent, env.myDrive);
    assert.equal(env.config.parentFolderId, null);
  }
});

test('choosing a destination requires the existing Advanced Drive service to be enabled', () => {
  const env = environment();
  env.properties.set('PIPELINE_PARENT_FOLDER_ID', 'event-folder');
  env.context.Drive = undefined;
  assert.throws(() => env.context.claimRootFolder_(env.config), /Enable the Advanced Drive service/);
  assert.equal(env.calls.filter(call => call[0] === 'create').length, 0);
});
