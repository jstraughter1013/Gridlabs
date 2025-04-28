import { SimpleGrid, Box, Text } from '@chakra-ui/react';
import items, { GridItem } from 'virtual:gridlabs-map';
import { Link } from 'react-router-dom';

const GridView = () => (
  <SimpleGrid columns={[1, 2, 3]} spacing={4} p={6}>
    {items.map((file: GridItem) => (
      <Box
        key={file.id}
        borderWidth="1px"
        borderRadius="lg"
        overflow="hidden"
        _hover={{ shadow: 'md' }}
      >
        <Box bg="gray.50" p={2}>
          <Text fontSize="sm" isTruncated>
            {file.name}
          </Text>
        </Box>
        <Box
          as={Link}
          to={`/__grid/preview?id=${file.id}`}
          h="240px"
          w="100%"
        />
      </Box>
    ))}
  </SimpleGrid>
);

export default GridView;