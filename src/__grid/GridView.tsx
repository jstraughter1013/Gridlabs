import {
  SimpleGrid,
  Box,
  Text,
  LinkBox,
  LinkOverlay,
  useColorModeValue,
} from "@chakra-ui/react";
import { Copy } from "lucide-react";
import { useState, useEffect } from "react";
import items, { GridItem } from "virtual:gridlabs-map";
import { Link as RouterLink, Outlet } from "react-router-dom";

const GridView = () => {
  const [copied, setCopied] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const cardBg = useColorModeValue("gray.50", "gray.700");

  // Set up Firebase Storage URLs for thumbnails
  useEffect(() => {
    const thumbUrls: Record<string, string> = {};
    const cdnBase = `https://firebasestorage.googleapis.com/v0/b/${import.meta.env.VITE_FIREBASE_BUCKET || 'gridlabs-b59b7.appspot.com'}/o/gridshots/${import.meta.env.VITE_COMMIT_SHA || 'local'}`;

    items.forEach((file: GridItem) => {
      thumbUrls[file.name] = `${cdnBase}%2F${encodeURIComponent(file.name.replace(/[^a-z0-9]/gi, "_") + ".png")}?alt=media`;
    });

    setThumbs(thumbUrls);
  }, [items]);

  // helper for share-link copy
  const copyShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (items.length === 0) {
    return (
      <Box p={10} textAlign="center" color="gray.500">
        No components yet – create one in <code>src/</code> to see it appear
        here.
      </Box>
    );
  }

  return (
    <>
      <Outlet />
      <SimpleGrid columns={[1, 2, 3]} spacing={6} p={[4, 8]}>
        {items.map((file: GridItem) => (
          <LinkBox
            as={Box}
            key={file.id}
            borderWidth="1px"
            borderRadius="lg"
            bg={cardBg}
            _hover={{ shadow: "md", transform: "translateY(-2px)" }}
            transition="all .15s ease"
          >
            <Box p={2} borderBottomWidth="1px">
              <Text fontSize="sm" isTruncated>
                {file.name}
              </Text>
            </Box>

            <LinkOverlay
              as={RouterLink}
              to={`/__grid/preview?id=${file.id}`}
              display="block"
              height="200px"
              style={{
                backgroundImage: thumbs[file.name] ? `url(${thumbs[file.name]})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            />
          </LinkBox>
        ))}
      </SimpleGrid>

      {/* floating share button */}
      <Box
        position="fixed"
        bottom={6}
        right={6}
        bg="blue.500"
        color="white"
        p={3}
        borderRadius="full"
        cursor="pointer"
        _hover={{ bg: "blue.600" }}
        title="Copy share link"
        onClick={copyShare}
      >
        {copied ? "✓" : <Copy size={18} />}
      </Box>
    </>
  );
};

export default GridView;