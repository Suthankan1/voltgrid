resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com"
  ]
}


data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    effect = "Allow"

    actions = [
      "sts:AssumeRoleWithWebIdentity"
    ]

    principals {
      type = "Federated"

      identifiers = [
        aws_iam_openid_connect_provider.github.arn
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"

      values = [
        "sts.amazonaws.com"
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"

      values = [
        "repo:Suthankan1@131566783/voltgrid@1359721202:ref:refs/heads/main"
      ]
    }
  }
}


resource "aws_iam_role" "github_actions_ecr" {
  name = "${local.name_prefix}-github-actions-ecr"

  assume_role_policy = data.aws_iam_policy_document.github_actions_assume_role.json

  tags = {
    Name = "${local.name_prefix}-github-actions-ecr"
  }
}


data "aws_iam_policy_document" "github_actions_ecr" {
  statement {
    sid = "EcrAuthentication"

    actions = [
      "ecr:GetAuthorizationToken"
    ]

    resources = [
      "*"
    ]
  }

  statement {
    sid = "PushServiceImages"

    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart"
    ]

    resources = [
      for repository in aws_ecr_repository.service :
      repository.arn
    ]
  }

  # ECS task-definition registration APIs do not support useful
  # resource-level scoping, so these actions require "*".
  statement {
    sid = "RegisterStationTaskDefinition"

    actions = [
      "ecs:DescribeTaskDefinition",
      "ecs:RegisterTaskDefinition"
    ]

    resources = [
      "*"
    ]
  }

  # GitHub Actions may update only the Station ECS service.
  statement {
    sid = "DeployStationService"

    actions = [
      "ecs:DescribeServices",
      "ecs:UpdateService"
    ]

    resources = [
      aws_ecs_service.station.id
    ]
  }

  # Registering a task definition references the Station task execution role.
  # Allow GitHub Actions to pass only that role and only to ECS tasks.
  statement {
    sid = "PassStationTaskExecutionRole"

    actions = [
      "iam:PassRole"
    ]

    resources = [
      aws_iam_role.station_task_execution.arn
    ]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"

      values = [
        "ecs-tasks.amazonaws.com"
      ]
    }
  }
}


resource "aws_iam_role_policy" "github_actions_ecr" {
  name = "${local.name_prefix}-github-actions-ecr"

  role   = aws_iam_role.github_actions_ecr.id
  policy = data.aws_iam_policy_document.github_actions_ecr.json
}