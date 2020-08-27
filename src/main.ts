import * as core from '@actions/core'
import * as utility from './utility'
import * as action from './action'

run()

async function run(): Promise<void> {
  try {
    const user = core.getInput('user', {required: true})
    const visibility = core.getInput('visibility', {required: true})
    const config = await utility.readConfigAny()
    const context = await utility.getContextAny()
    const result = await action.createList(user, visibility, config, context)

    await utility.setOutput(result)
  } catch (error) {
    core.setFailed(error.message)
  }
}
