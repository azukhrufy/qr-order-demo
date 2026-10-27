import { useState } from "react";
import Head from "next/head";
import { Box, Button, Flex, Heading, HStack, Input, Text } from "@chakra-ui/react";
import { FiPrinter, FiRefreshCw } from "react-icons/fi";

/**
 * Generator QR stand yang bisa dibuka dari HP/browser mana pun (tanpa shell).
 * Layout A6 siap cetak; QR dibuat oleh /api/qr sehingga otomatis mengikuti
 * domain tempat aplikasi ini berjalan.
 */
export default function QrPage() {
  const [meja, setMeja] = useState("12");
  const [resto, setResto] = useState("Cafe Demo");
  const [nonce, setNonce] = useState(0);

  const src = `/api/qr?meja=${encodeURIComponent(meja)}&v=${nonce}`;

  return (
    <>
      <Head>
        <title>QR Stand — Meja {meja}</title>
        <style>{`
          @media print {
            @page { size: A6 portrait; margin: 0; }
            .no-print { display: none !important; }
            body { background: #fff !important; }
            .stand {
              width: 105mm !important;
              height: 148mm !important;
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }
          }
        `}</style>
      </Head>

      <Box minH="100vh" bg="surface.900" px={4} py={6}>
        <Box maxW="520px" mx="auto">
          <Heading size="md" mb={1} className="no-print">
            QR Stand Meja
          </Heading>
          <Text fontSize="sm" color="ink.500" mb={4} className="no-print">
            Isi nomor meja dan nama resto, lalu cetak (A6) atau screenshot kartunya.
          </Text>

          <HStack mb={2} className="no-print" spacing={2}>
            <Input
              value={resto}
              onChange={(e) => setResto(e.target.value)}
              placeholder="Nama resto"
              bg="surface.800"
              borderColor="surface.600"
              size="sm"
            />
            <Input
              value={meja}
              onChange={(e) => setMeja(e.target.value)}
              placeholder="Meja"
              w="90px"
              bg="surface.800"
              borderColor="surface.600"
              size="sm"
              inputMode="numeric"
            />
          </HStack>

          <HStack mb={4} className="no-print" spacing={2}>
            <Button size="sm" leftIcon={<FiPrinter />} onClick={() => window.print()} bg="brand.400" color="surface.900" _hover={{ bg: "brand.300" }}>
              Cetak / Simpan PDF
            </Button>
            <Button size="sm" leftIcon={<FiRefreshCw />} onClick={() => setNonce((n) => n + 1)} bg="surface.700" color="ink.50" borderWidth="1px" borderColor="surface.600" _hover={{ bg: "surface.600" }}>
              Muat ulang QR
            </Button>
            <Button
              as="a"
              size="sm"
              href={`/api/qr?meja=${encodeURIComponent(meja)}&format=png`}
              download={`qr-meja-${meja}.png`}
              bg="surface.700"
              color="ink.50"
              borderWidth="1px"
              borderColor="surface.600"
              _hover={{ bg: "surface.600" }}
            >
              Unduh PNG
            </Button>
          </HStack>

          <Flex direction="column" align="center" justify="space-between"
            w="105mm" h="148mm" mx="auto" p="10mm 9mm" borderRadius="18px"
            borderWidth="1px" borderColor="surface.600"
            bg="radial-gradient(120% 80% at 50% 0%, #241d14 0%, #12100e 60%)"
            className="stand">
            <Box textAlign="center">
              <Text fontSize="9pt" letterSpacing="3px" textTransform="uppercase" color="brand.400">
                {resto || "Resto"}
              </Text>
              <Text fontSize="26pt" fontWeight={800} lineHeight="1" mt="2mm">
                MEJA {meja || "?"}
              </Text>
            </Box>

            <Box bg="white" p="5mm" borderRadius="5mm" w="66mm" h="66mm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`QR meja ${meja}`} style={{ width: "100%", height: "100%", display: "block" }} />
            </Box>

            <Text fontSize="9.5pt" textAlign="center" lineHeight="1.45">
              Scan untuk melihat menu &amp;
              <br />
              <b>pesan langsung dari meja ini</b>
            </Text>

            <Text fontSize="7.5pt" textAlign="center" color="ink.500">
              Tanpa install aplikasi · pesanan langsung masuk ke staf
            </Text>
          </Flex>

          <Text fontSize="xs" color="ink.500" mt={4} className="no-print">
            QR mengarah ke <code>{`/tamu?meja=${meja}&t=…`}</code> pada domain ini — token
            meja ikut di dalam QR, jadi nomor meja tidak bisa ditebak orang luar.
          </Text>
        </Box>
      </Box>
    </>
  );
}
