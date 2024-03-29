import * as utility from './utility'

export async function createList(user: string, visibility: string, config: any, context: any): Promise<string> {
  const repos = await getReposList(user, visibility)
  const groups = await getGroups(repos, config)
  const result = formatBody(groups, config, context)

  return result
}

function formatBody(groups: any[], config: any, context: any): string {
  let format = ''
  const values = {
    context: context,
    groups: groups,
    groupsFormatted: formatGroups(groups, config, context)
  }

  format += utility.formatValues(config.body, values)
  format = utility.normalize(format)

  return format
}

function formatGroups(groups: any[], config: any, context: any): string {
  let format = ''

  for (const group of groups) {
    const values = {
      context: context,
      groups: groups,
      group: group,
      repositoriesFormatted: formatRepositories(group.repositories, config, context)
    }

    format += utility.formatValues(config.group, values)
  }

  return format
}

function formatRepositories(repositories: any[], config: any, context: any): string {
  let format = ''

  for (const repository of repositories) {
    const values = {
      context: context,
      repositories: repositories,
      repository: repository,
      repositoryLabelFormatted: formatRepositoryLabel(repository, config, context),
      repositoryReleaseFormatted: formatRepositoryRelease(repository, config, context)
    }

    format += utility.formatValues(config.repository, values)
  }

  return format
}

function formatRepositoryLabel(repository: any, config: any, context: any): string {
  let format = ''

  if (repository.private) {
    format += 'Private'
  }

  if (repository.archived) {
    if (format !== '') {
      format += ' '
    }

    format += 'Archived'
  } else {
    if (repository.is_template) {
      if (format !== '') {
        format += ' '
      }

      format += 'Template'
    }
  }

  if (format !== '') {
    const values = {
      context: context,
      repository: repository,
      repositoryLabel: format
    }

    return utility.formatValues(config.repositoryLabel, values)
  }

  return ''
}

function formatRepositoryRelease(repository: any, config: any, context: any): string {
  let format = ''

  if (repository.latestRelease != null) {
    const values = {
      context: context,
      repository: repository,
      release: repository.latestRelease
    }

    format = utility.formatValues(config.repositoryRelease, values)
  }

  return format
}

async function getReposList(user: string, visibility: string): Promise<any[]> {
  const octokit = utility.getOctokit()
  const type = await getUserType(user)
  const repos = await octokit.paginate(`GET /${type}s/${user}/repos`, {
    mediaType: {
      previews: ['mercy', 'nebula', 'baptiste']
    }
  })

  const result = []

  for (const repo of repos) {
    if (visibility === 'all' || repo.visibility === visibility) {
      result.push(repo)
    }
  }

  return result
}

async function getUserType(user: string): Promise<string> {
  const octokit = utility.getOctokit()
  const response = await octokit.request(`GET /users/${user}`)
  const type = response.data.type

  switch (type) {
    case 'User':
      return 'user'
    case 'Organization':
      return 'org'
    default:
      throw `Invalid user type: '${type}' for '${user}'.`
  }
}

async function getGroups(repos: any[], config: any): Promise<any[]> {
  const groups = []

  for (const group of config.groups) {
    const topics = group.topics.split(',')
    const repositories = await getReposByTopics(repos, topics)

    if (repositories.length > 0) {
      repositories.sort((a, b) => a.name.localeCompare(b.name))

      groups.push({
        name: group.name,
        description: group.description,
        repositories: repositories
      })
    }
  }

  return groups
}

async function getReposByTopics(repos: any[], topics: any[]): Promise<any[]> {
  const result = []

  for (const repo of repos) {
    if (hasAnyTopic(repo, topics)) {
      repo['latestRelease'] = await getLatestRelease(repo)

      result.push(repo)
    }
  }

  return result
}

function hasAnyTopic(repo: any, topics: any[]): boolean {
  for (const topic of topics) {
    if (repo.topics.includes(topic.trim())) {
      return true
    }
  }

  return false
}

async function getLatestRelease(repo: any): Promise<any> {
  var result = null
  var releases = await utility.getReleases(repo.owner.login, repo.name)

  if (releases.length > 0) {
    var releasesPublished = []

    for (const release of releases) {
      if (!release.draft) {
        releasesPublished.push(release)
      }
    }

    releasesPublished.sort((a, b) => b.published_at.localeCompare(a.published_at))

    result = releasesPublished[0]
  }

  return result
}
