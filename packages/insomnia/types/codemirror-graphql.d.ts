import { GraphQLInfoOptions } from 'codemirror-graphql/info';

declare module 'codemirror-graphql/jump' {
  type ModifiedGraphQLJumpOptions = Omit<GraphQLInfoOptions, 'onClick'> & {
    onClick: GraphQLInfoOptions['onClick'];
  };
}
