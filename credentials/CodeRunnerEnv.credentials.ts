import {
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class CodeRunnerEnv implements ICredentialType {
  name = 'codeRunnerEnv';
  displayName = 'CodeRunner Environment Variables';
  properties: INodeProperties[] = [
    {
      displayName: 'Environment Variables',
      name: 'envVars',
      type: 'string',
      typeOptions: {
        editor: 'codeNodeEditor',
      },
      default: '',
      hint: 'Newline separated list of environment variables in the format KEY=VALUE',
      placeholder: 'KEY=VALUE\nANOTHER_KEY=ANOTHER_VALUE\n...',
    },
  ];
}
