import { Center, Spinner } from '@chakra-ui/react';
import { useSearchParams } from 'react-router-dom';
import items, { GridItem } from 'virtual:gridlabs-map';
import { lazy, Suspense } from 'react';

const Preview = () => {
  const [params] = useSearchParams();
  const id = Number(params.get('id') ?? -1);
  const item = items.find((file: GridItem) => file.id === id);

  if (!item) return <Center p={8}>Unknown component</Center>;

  // Dynamic import *without* bundler magic comments - vite will handle
  const Comp = lazy(() => import(/* @vite-ignore */ item.file));

  return (
    <Suspense
      fallback={
        <Center h="100%">
          <Spinner />
        </Center>
      }
    >
      <Comp />
    </Suspense>
  );
};

export default Preview;