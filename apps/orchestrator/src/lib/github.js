const { Octokit } = require('octokit');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const LABEL = process.env.ISSUE_LABEL;

async function getOpenIssues() {
  const params = {
    owner: OWNER,
    repo: REPO,
    state: 'open',
    per_page: 100,
    sort: 'created',
    direction: 'asc'
  };

  if (LABEL && LABEL.trim()) {
    params.labels = LABEL;
  }

  const { data } = await octokit.rest.issues.listForRepo(params);
  return data.filter(issue => !issue.pull_request);
}

async function getIssue(issueNumber) {
  const { data } = await octokit.rest.issues.get({
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber
  });
  return data;
}

async function closeIssue(issueNumber, comment) {
  if (comment) {
    await octokit.rest.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
      body: comment
    });
  }

  await octokit.rest.issues.update({
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    state: 'closed'
  });
}

async function addComment(issueNumber, body) {
  await octokit.rest.issues.createComment({
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    body
  });
}

async function createIssue(title, body, options = {}) {
  const params = {
    owner: OWNER,
    repo: REPO,
    title,
    body
  };

  const labels = options.labels || (LABEL && LABEL.trim() ? [LABEL.trim()] : []);
  if (labels.length > 0) {
    params.labels = labels;
  }

  const { data } = await octokit.rest.issues.create(params);
  return data;
}

module.exports = {
  getOpenIssues,
  getIssue,
  closeIssue,
  addComment,
  createIssue
};
