import { Code, Container, Text, Title } from '@mantine/core';

export function Home() {
  return (
    <Container py="xl">
      <Title order={1}>Noesis</Title>
      <Text mt="md">
        Edit <Code>src/routes/index.tsx</Code> to get started.
      </Text>
    </Container>
  );
}
