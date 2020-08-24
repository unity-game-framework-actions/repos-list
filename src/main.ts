import * as core from '@actions/core'
import * as github from '@actions/github'
import * as utility from './utility'

run()

async function run(): Promise<void> {
  try {
    console.log('This is a draft action.')
  } catch (error) {
    core.setFailed(error.message)
  }
}
