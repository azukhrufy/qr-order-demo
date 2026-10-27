import Head from "next/head";
import Link from "next/link";
import { Box, Button, Heading, Stack, Text, useToast } from "@chakra-ui/react";
import { FiGrid, FiMonitor, FiRefreshCw } from "react-icons/fi";

export default function Home() {
  const toast = useToast();

  async function reset() {
    await fetch("/api/reset", { method: "POST" });
    toast({
      title: "State demo dikosongkan",
      status: "success",
      duration: 2200,
      isClosable: true,
      position: "bottom"
    });
  }

  return (
    <>
      <Head>
        <title>QR Order Demo — pesan dari meja</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <Box minH="100vh" display="grid" placeItems="center" p={6}>
        <Box
          w="100%"
          maxW="460px"
          bg="surface.800"
          borderWidth="1px"
          borderColor="surface.600"
          borderRadius="20px"
          p={7}
        >
          <Heading size="md" mb={2}>
            QR Order — demo alur
          </Heading>
          <Text color="ink.500" fontSize="sm" mb={5}>
            Tamu scan QR di meja, pesanan langsung masuk ke layar staf, dan ketersediaan menu bisa
            diubah real-time. Buka dua layar ini bersamaan (HP + laptop) untuk melihat alurnya.
          </Text>

          <Stack spacing={3}>
            <Button
              as={Link}
              href="/tamu"
              bg="brand.400"
              color="surface.900"
              size="lg"
              leftIcon={<FiGrid />}
              _hover={{ bg: "brand.300" }}
            >
              Halaman tamu (scan QR / menu)
            </Button>

            <Button
              as={Link}
              href="/staf"
              size="lg"
              bg="surface.700"
              color="ink.50"
              borderWidth="1px"
              borderColor="surface.600"
              leftIcon={<FiMonitor />}
              _hover={{ bg: "surface.600" }}
            >
              Layar staf (pesanan &amp; ketersediaan)
            </Button>

            <Button variant="ghost" color="ink.500" leftIcon={<FiRefreshCw />} onClick={reset}>
              Reset state demo
            </Button>
          </Stack>

          <Text color="ink.500" fontSize="xs" mt={5} lineHeight="tall">
            Demo: data di memori, tanpa login, tanpa pembayaran. Untuk demo di lokasi, jalankan server
            di laptop lalu buka dari HP di jaringan yang sama.
          </Text>
        </Box>
      </Box>
    </>
  );
}
