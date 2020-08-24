import * as core from '@actions/core'
import * as github from '@actions/github'
import {promises as fs} from 'fs'
import * as ofs from 'fs'
import * as yaml from 'js-yaml'
import * as eol from 'eol'
import indentString from 'indent-string'
import objectPath from 'object-path'

export async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path, ofs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

export function merge(target: any, source: any): any {
  return Object.assign(target, source)
}

export async function readConfigAny(): Promise<any> {
  const value = core.getInput('config')
  const result = await getDataAny(value)

  return result.data
}

export async function readConfig(): Promise<any> {
  const path = core.getInput('configPath', {required: true})
  const type = core.getInput('configType', {required: true})

  return await readData(path, type)
}

export async function getDataAny(value: string): Promise<{type: string; data: any}> {
  if (await exists(value)) {
    const data = await readDataAny(value)

    return data
  } else {
    const data = parseAny(value)

    return {
      type: data.type,
      data: data.result
    }
  }
}

export async function readDataAny(path: string): Promise<{type: string; data: any}> {
  const value = await read(path)
  const data = parseAny(value)

  return {
    type: data.type,
    data: data.result
  }
}

export async function readData(path: string, type: string): Promise<any> {
  const value = await read(path)
  const data = parse(value, type)

  return data
}

export async function read(path: string): Promise<string> {
  const buffer = await fs.readFile(path)

  return buffer.toString()
}

export async function writeData(path: string, data: any, type: string): Promise<void> {
  const value = format(data, type)

  await write(path, value)
}

export async function write(path: string, value: string): Promise<void> {
  await fs.writeFile(path, value)
}

export function format(value: any, type: string): string {
  switch (type) {
    case 'json':
      return JSON.stringify(value, null, 2).trim()
    case 'yaml':
      return yaml.dump(value).trim()
    default:
      throw `Invalid format type: '${type}'.`
  }
}

export function parseAny(value: string): {type: string; result: any} {
  try {
    return {
      type: 'json',
      result: JSON.parse(value)
    }
  } catch {
    try {
      return {
        type: 'yaml',
        result: yaml.load(value)
      }
    } catch {
      throw `Invalid parse value, expected Json or Yaml.`
    }
  }
}

export function parse(value: string, type: string): any {
  if (value === '') {
    return {}
  }

  switch (type) {
    case 'json':
      return JSON.parse(value)
    case 'yaml':
      return yaml.load(value)
    default:
      throw `Invalid parse type: '${type}'.`
  }
}

export async function getContextAny(): Promise<any> {
  const context = core.getInput('context', {required: true})
  const result = await getDataAny(context)

  return result.data
}

export async function getInputAny(): Promise<any> {
  const input = core.getInput('input', {required: true})
  const result = await getDataAny(input)

  return result.data
}

export async function getInput(): Promise<any> {
  const input = core.getInput('input', {required: true})
  const inputSource = core.getInput('inputSource', {required: true})
  const inputType = core.getInput('inputType', {required: true})

  switch (inputSource) {
    case 'value':
      return parse(input, inputType)
    case 'file':
      return await readData(input, inputType)
    default:
      throw `Invalid output type: '${inputSource}'.`
  }
}

export async function setOutput(value: string) {
  core.setOutput('result', value)

  const output = core.getInput('output')

  if (output !== '') {
    await write(output, value)
  }
}

export async function setOutputByType(type: string, value: string) {
  switch (type) {
    case 'action':
      setOutputAction(value)
      break
    case 'file':
      await setOutputFile(value)
      break
    case 'all':
      setOutputAction(value)
      await setOutputFile(value)
      break
    default:
      throw `Invalid output type: '${type}'.`
  }
}

export function setOutputAction(value: string) {
  core.setOutput('result', value)
}

export async function setOutputFile(value: string) {
  const path = core.getInput('outputPath', {required: true})

  await write(path, value)
}

export function normalize(value: string): string {
  return eol.crlf(value)
}

export function formatValues(value: string, values: any): string {
  const matches = value.match(new RegExp('{([^{}]+)}', 'g'))

  if (matches != null && matches.length > 0) {
    for (const match of matches) {
      if (match !== '') {
        const path = match.substr(1, match.length - 2)
        const replace = getValue(values, path)

        value = value.replace(match, replace)
      }
    }
  }

  return value
}

export function indent(value: string, count: number): string {
  return indentString(value, count)
}

export function getValue(target: any, path: string): any {
  return objectPath.get(target, path)
}

export function setValue(target: any, path: string, value: any) {
  objectPath.set(target, path, value)
}

export function getRepository(): {owner: string; repo: string} {
  const repository = core.getInput('repository')

  return getOwnerAndRepo(repository)
}

export function getOwnerAndRepo(repo: string): {owner: string; repo: string} {
  const split = repo.split('/')

  if (split.length < 2) {
    throw `Invalid repository name: '${repo}'.`
  }

  return {
    owner: split[0],
    repo: split[1]
  }
}

export function formatDate(date: Date, config: any): any {
  const result: any = {}
  const keys = Object.keys(config)

  for (const key of keys) {
    if (key !== 'locale') {
      const options = {
        [key]: config[key]
      }

      const format = new Intl.DateTimeFormat(config.locale, options)

      result[key] = format.format(date)
    }
  }

  return result
}

export function getOctokit(): any {
  const token = core.getInput('token', {required: true})

  return github.getOctokit(token)
}

export async function containsInBranch(owner: string, repo: string, branch: string, target: string): Promise<boolean> {
  const octokit = getOctokit()

  try {
    const response = await octokit.request(`GET /repos/${owner}/${repo}/compare/${branch}...${target}`)
    const data = response.data

    if (data.hasOwnProperty('status')) {
      const status = data.status

      return status === 'behind' || status === 'identical'
    }

    return false
  } catch {
    return false
  }
}

export async function getIssue(owner: string, repo: string, number: string): Promise<any> {
  const octokit = getOctokit()
  const response = await octokit.request(`GET /repos/${owner}/${repo}/issues/${number}`)

  return response.data
}

export async function getMilestone(owner: string, repo: string, milestoneNumberOrTitle: string): Promise<any> {
  const octokit = getOctokit()

  try {
    const response = await octokit.request(`GET /repos/${owner}/${repo}/milestones/${milestoneNumberOrTitle}`)

    return response.data
  } catch {
    const milestones = await octokit.paginate(`GET /repos/${owner}/${repo}/milestones?state=all`)

    for (const milestone of milestones) {
      if (milestone.title === milestoneNumberOrTitle) {
        return milestone
      }
    }

    throw `Milestone not found by the specified number or title: '${milestoneNumberOrTitle}'.`
  }
}

export async function getMilestones(owner: string, repo: string, state: string): Promise<any[]> {
  const octokit = getOctokit()
  const milestones = await octokit.paginate(`GET /repos/${owner}/${repo}/milestones?state=${state}`)

  return milestones
}

export async function getMilestoneIssues(owner: string, repo: string, milestone: number, state: string, labels: string): Promise<any[]> {
  const octokit = getOctokit()
  const issues = await octokit.paginate(`GET /repos/${owner}/${repo}/issues?milestone=${milestone}&state=${state}&labels=${labels}`)

  return issues
}

export async function updateContent(owner: string, repo: string, content: string, file: string, branch: string, message: string, user: string, email: string): Promise<void> {
  const octokit = getOctokit()
  const info = await octokit.request(`GET /repos/${owner}/${repo}/contents/${file}?ref=${branch}`)
  const base64 = Buffer.from(content).toString('base64')
  const sha = info.data.sha

  await octokit.repos.createOrUpdateFile({
    owner: owner,
    repo: repo,
    path: file,
    message: message,
    content: base64,
    sha: sha,
    branch: branch,
    committer: {
      name: user,
      email: email
    },
    author: {
      name: user,
      email: email
    }
  })
}

export async function getRelease(owner: string, repo: string, idOrTag: string): Promise<any> {
  const octokit = getOctokit()

  try {
    const response = await octokit.request(`GET /repos/${owner}/${repo}/releases/${idOrTag}`)

    return response.data
  } catch {
    try {
      const response = await octokit.request(`GET /repos/${owner}/${repo}/releases/tags/${idOrTag}`)

      return response.data
    } catch {
      throw `Release by the specified id or tag name not found: '${idOrTag}'.`
    }
  }
}

export async function getReleases(owner: string, repo: string): Promise<any[]> {
  const octokit = getOctokit()

  return await octokit.paginate(`GET /repos/${owner}/${repo}/releases`)
}

export async function getReleasesByBranch(owner: string, repo: string, branch: string): Promise<any[]> {
  const releases = await getReleases(owner, repo)
  const result = []

  for (const release of releases) {
    if (await containsInBranch(owner, repo, branch, release.tag_name)) {
      result.push(release)
    }
  }

  return result
}

export async function updateRelease(owner: string, repo: string, release: any): Promise<void> {
  const octokit = getOctokit()

  await octokit.repos.updateRelease({
    owner: owner,
    repo: repo,
    release_id: release.id,
    tag_name: release.tag_name,
    target_commitish: release.target_commitish,
    name: release.name,
    body: release.body,
    draft: release.draft,
    prerelease: release.prerelease
  })
}

export async function getTags(owner: string, repo: string): Promise<any[]> {
  const octokit = getOctokit()

  return await octokit.paginate(`GET /repos/${owner}/${repo}/tags`)
}

export async function getTagsByBranch(owner: string, repo: string, branch: string): Promise<any[]> {
  const tags = await getTags(owner, repo)
  const result = []

  for (const tag of tags) {
    if (await containsInBranch(owner, repo, branch, tag.name)) {
      result.push(tag)
    }
  }

  return result
}

export async function dispatch(owner: string, repo: string, eventType: string, payload: any): Promise<void> {
  const octokit = getOctokit()

  await octokit.repos.createDispatchEvent({
    owner: owner,
    repo: repo,
    event_type: eventType,
    client_payload: JSON.stringify(payload)
  })
}
