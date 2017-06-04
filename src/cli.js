#!/usr/bin/env node
/* eslint-disable no-console */
import { join, relative, isAbsolute, dirname, basename, extname } from 'path'
import { copy, move, readFileSync, writeFileSync } from 'fs-extra'
import { blue, red, bold } from 'chalk'
import meow from 'meow'
import inquirer from 'inquirer'
import autocomplete from 'inquirer-autocomplete-prompt'
import ora from 'ora'
import { component, name, folder } from './prompts'
import {
  getComponentName,
  getComponentFolder,
  isSingleFile,
  getFiles,
  getComponentFiles,
  replaceContents,
} from './utils'

const cli = meow(`
  Usage
    $ generact [path]

  Options
    --root Sets the root path to scan for component files.

  Examples
    $ generact
    $ generact src/components/Button.js
    $ generact ../src/components/Button
    $ generact --root src/components
`)

const replicate = async (path) => {
  const originalName = getComponentName(path)
  const absolutePath = isAbsolute(path) ? path : join(process.cwd(), path)
  const relativePath = relative(process.cwd(), absolutePath)
  const originalFolder = getComponentFolder(relativePath)

  const answers = await inquirer.prompt([
    name(originalName),
    folder(originalFolder),
  ])

  if (isSingleFile(path)) {
    const destinationPath = join(answers.folder, answers.name + extname(path))
    await copy(absolutePath, destinationPath)
    const contents = readFileSync(destinationPath).toString()
    writeFileSync(destinationPath, replaceContents(contents, originalName, answers.name))
  } else {
    const destinationPath = join(answers.folder, answers.name)
    await copy(dirname(absolutePath), destinationPath)
    const scriptFiles = getFiles(destinationPath, true)

    scriptFiles.forEach(async (file) => {
      const contents = readFileSync(file).toString()
      writeFileSync(file, replaceContents(contents, originalName, answers.name))
    })

    getFiles(destinationPath).forEach(async (file) => {
      await move(file, join(dirname(file), basename(file).replace(originalName, answers.name)))
    })
  }
}

const scan = async (root = process.cwd()) => {
  const absoluteRoot = isAbsolute(root) ? root : join(process.cwd(), root)
  const spinner = ora(`Scanning ${blue(absoluteRoot)} for React component files...`).start()
  const files = await getComponentFiles(absoluteRoot)
  spinner.stop()

  if (!files.length) {
    console.log(red.bold('No components found! :(\n'))
    console.log(`Make sure you are running ${bold('generact')} inside a React-like project directory or using ${bold('root')} option:\n`)
    console.log('    $ generact --root ../path/to/my/other/react/project\n')
    console.log(`If you are already doing that, it means that ${bold('generact')} could not find your React component files automagically.`)
    console.log('In this case, you can explicitly pass the component path to replicate:\n')
    console.log('    $ generact path/to/my/react/component.js\n')
    return process.exit(1)
  }

  inquirer.registerPrompt('autocomplete', autocomplete)
  const answers = await inquirer.prompt([component(files)])
  return answers.component
}

if (cli.input.length) {
  replicate(cli.input[0])
} else {
  scan(cli.flags.root).then(replicate)
}
